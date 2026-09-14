/** @vitest-environment node */
import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  localDatabaseUrl,
} from "../local-config";
import {
  migrateLocalDb,
  resetLocalDb,
  seedLocalDb,
  startLocalDb,
  stopLocalDb,
} from "../../../../scripts/local-db";

const MARKER_EMAIL = "docker-persistence-marker@example.com";

async function queryEmails(url: string): Promise<string[]> {
  const client = postgres(url, { max: 1, connect_timeout: 5, onnotice: () => undefined });
  try {
    const rows = await client<{ email: string }[]>`SELECT email FROM users ORDER BY email`;
    return rows.map((row) => row.email);
  } finally {
    await client.end({ timeout: 5 });
  }
}

async function insertMarker(url: string): Promise<void> {
  const client = postgres(url, { max: 1, connect_timeout: 5, onnotice: () => undefined });
  try {
    await client`
      INSERT INTO users (email, name, role)
      VALUES (${MARKER_EMAIL}, 'Persistence Marker', 'worker')
      ON CONFLICT (email) DO NOTHING
    `;
  } finally {
    await client.end({ timeout: 5 });
  }
}

describe.skipIf(process.env.RUN_DOCKER_DB_TESTS !== "1")("docker postgres isolation", () => {
  it("starts, migrates, seeds, preserves dev data, and isolates test reset", async () => {
    const devUrl = localDatabaseUrl("dev");
    const testUrl = localDatabaseUrl("test");

    await startLocalDb("all");
    await migrateLocalDb("dev");
    await seedLocalDb("dev");
    await insertMarker(devUrl);

    const emailsBeforeReset = await queryEmails(devUrl);
    expect(emailsBeforeReset).toContain(MARKER_EMAIL);
    expect(emailsBeforeReset).toContain("worker1@example.com");

    await resetLocalDb("test");

    const testEmails = await queryEmails(testUrl);
    const devEmailsAfterTestReset = await queryEmails(devUrl);

    expect(testEmails).toContain("worker1@example.com");
    expect(testEmails).toContain("recruiter-pro@example.com");
    expect(testEmails).not.toContain(MARKER_EMAIL);
    expect(devEmailsAfterTestReset).toContain(MARKER_EMAIL);

    await stopLocalDb("dev");
    await startLocalDb("dev");
    const devEmailsAfterRestart = await queryEmails(devUrl);
    expect(devEmailsAfterRestart).toContain(MARKER_EMAIL);
  }, 180000);

  afterAll(async () => {
    const client = postgres(localDatabaseUrl("dev"), {
      max: 1,
      connect_timeout: 5,
      onnotice: () => undefined,
    });
    try {
      await client`DELETE FROM users WHERE email = ${MARKER_EMAIL}`;
    } catch {
      // Dev DB may be unavailable if Docker was stopped mid-test.
    } finally {
      await client.end({ timeout: 5 });
    }
  });
});
