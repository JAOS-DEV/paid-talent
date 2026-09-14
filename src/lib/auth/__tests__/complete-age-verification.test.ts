/** @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { localDatabaseUrl } from "../../db/local-config";
import { parseDatabaseUrl } from "../../db/safety";
import { startLocalDb } from "../../../../scripts/local-db";
import type { completeAgeVerification as CompleteAgeVerification } from "../complete-age-verification";

function isLocalTestDatabase(url: string | undefined): boolean {
  const parsed = parseDatabaseUrl(url);
  return (
    parsed.ok &&
    parsed.parsed.local &&
    parsed.parsed.database === "paid_talent_test"
  );
}

const TEST_URL = localDatabaseUrl("test");
const shouldRun = process.env.RUN_DOCKER_DB_TESTS === "1";

describe("completeAgeVerification request guards", () => {
  it("rejects anonymous callers before touching identity fields", async () => {
    const { completeAgeVerification } = await import("../complete-age-verification");
    const result = await completeAgeVerification({
      session: null,
      dateOfBirth: "1998-04-12",
      signupIntentRole: "worker",
    });
    expect(result).toEqual({ ok: false, status: 401, error: "Unauthorized" });
  });

  it("rejects pending sessions without a verified email", async () => {
    const { completeAgeVerification } = await import("../complete-age-verification");
    const result = await completeAgeVerification({
      session: { signupPending: true, email: "" },
      dateOfBirth: "1998-04-12",
      signupIntentRole: "worker",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });
});

describe.skipIf(!shouldRun)("completeAgeVerification against local test Postgres", () => {
  const unique = `pending-${Date.now()}@example.com`;
  let completeAgeVerification: typeof CompleteAgeVerification;

  beforeAll(async () => {
    await startLocalDb("test");
    process.env.DATABASE_URL = TEST_URL;
    vi.resetModules();
    vi.doUnmock("@/lib/db");
    ({ completeAgeVerification } = await import("../complete-age-verification"));
  }, 60000);

  it("creates a Worker from the pending Google identity, ignoring body email/role", async () => {
    expect(isLocalTestDatabase(process.env.DATABASE_URL)).toBe(true);

    const under20 = await completeAgeVerification({
      session: {
        signupPending: true,
        email: unique,
        name: "Pending User",
      },
      dateOfBirth: "2015-01-01",
      signupIntentRole: "worker",
      now: new Date("2026-09-14"),
    });
    expect(under20.ok).toBe(false);
    if (!under20.ok) {
      expect(under20.status).toBe(403);
    }

    const noRole = await completeAgeVerification({
      session: {
        signupPending: true,
        email: unique,
      },
      dateOfBirth: "1998-04-12",
      signupIntentRole: undefined,
      requestedRole: "recruiter",
      now: new Date("2026-09-14"),
    });
    expect(noRole.ok).toBe(false);
    if (!noRole.ok) {
      expect(noRole.status).toBe(400);
    }

    const spoofed = await completeAgeVerification({
      session: {
        signupPending: true,
        email: unique,
        name: "Pending User",
      },
      dateOfBirth: "1998-04-12",
      signupIntentRole: "worker",
      requestedEmail: "attacker@example.com",
      requestedRole: "recruiter",
      now: new Date("2026-09-14"),
    });
    expect(spoofed.ok).toBe(false);

    const ok = await completeAgeVerification({
      session: {
        signupPending: true,
        email: unique,
        name: "Pending User",
      },
      dateOfBirth: "1998-04-12",
      signupIntentRole: "worker",
      now: new Date("2026-09-14"),
    });

    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.role).toBe("worker");
      expect(ok.email).toBe(unique);
      expect(ok.promotedFromPending).toBe(true);
      expect(ok.redirectUrl).toBe("/worker/onboarding");
    }

    const client = postgres(TEST_URL, {
      max: 1,
      connect_timeout: 5,
      onnotice: () => undefined,
    });
    try {
      const rows = await client<{ email: string; role: string }[]>`
        SELECT email, role FROM users WHERE email = ${unique}
      `;
      expect(rows).toEqual([{ email: unique, role: "worker" }]);
    } finally {
      await client.end({ timeout: 5 });
    }
  }, 60000);

  afterAll(async () => {
    const client = postgres(TEST_URL, {
      max: 1,
      connect_timeout: 5,
      onnotice: () => undefined,
    });
    try {
      await client`DELETE FROM users WHERE email = ${unique}`;
    } catch {
      // Test DB may be unavailable.
    } finally {
      await client.end({ timeout: 5 });
    }
  });
});
