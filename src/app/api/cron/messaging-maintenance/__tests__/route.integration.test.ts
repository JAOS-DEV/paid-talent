/** @vitest-environment node */
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { localDatabaseUrl } from "@/lib/db/local-config";
import { parseDatabaseUrl } from "@/lib/db/safety";
import { migrateLocalDb, startLocalDb } from "../../../../../../scripts/local-db";

const TEST_URL = localDatabaseUrl("test");
const shouldRun = process.env.RUN_DOCKER_DB_TESTS === "1";

function isLocalTestDatabase(url: string | undefined): boolean {
  const parsed = parseDatabaseUrl(url);
  return (
    parsed.ok &&
    parsed.parsed.local &&
    parsed.parsed.database === "paid_talent_test"
  );
}

function cronRequest(authorization?: string): NextRequest {
  return new Request("http://localhost/api/cron/messaging-maintenance", {
    headers: authorization ? { authorization } : undefined,
  }) as NextRequest;
}

describe.skipIf(!shouldRun)(
  "GET /api/cron/messaging-maintenance against paid_talent_test",
  () => {
    let GET: (request: NextRequest) => Promise<{
      status: number;
      json: () => Promise<Record<string, unknown>>;
    }>;

    beforeAll(async () => {
      await startLocalDb("test");
      await migrateLocalDb("test");
      process.env.DATABASE_URL = TEST_URL;
      process.env.CRON_SECRET = "cron-integration-secret";
      expect(isLocalTestDatabase(process.env.DATABASE_URL)).toBe(true);
      vi.resetModules();
      vi.doUnmock("@/lib/db");
      ({ GET } = await import("../route"));
    }, 180000);

    it("returns 401 when the bearer is missing or wrong", async () => {
      const missing = await GET(cronRequest());
      expect(missing.status).toBe(401);

      const wrong = await GET(cronRequest("Bearer not-the-secret"));
      expect(wrong.status).toBe(401);
    });

    it("runs every maintenance step against the test database", async () => {
      const response = await GET(
        cronRequest("Bearer cron-integration-secret")
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.failed).toEqual([]);
      expect(body.messagingMaintenance).toEqual(
        expect.objectContaining({
          expired: expect.any(Number),
          released: expect.any(Number),
          workersProcessed: expect.any(Number),
        })
      );
      expect(typeof body.notificationsRetried).toBe("number");
      expect(body.retention).toEqual(
        expect.objectContaining({
          conversationsDeleted: expect.any(Number),
          contactRequestsDeleted: expect.any(Number),
          notificationsDeleted: expect.any(Number),
          messageFlagsDeleted: expect.any(Number),
          reportSnapshotsCleared: expect.any(Number),
        })
      );
      expect(body.verificationMedia).toEqual(
        expect.objectContaining({
          processed: expect.any(Number),
          idDocumentsDeleted: expect.any(Number),
          livenessVideosDeleted: expect.any(Number),
          errors: expect.any(Number),
          skipped: expect.any(Number),
        })
      );
      expect(body.accountPurge).toEqual(
        expect.objectContaining({
          usersPurged: expect.any(Number),
          mediaObjectsDeleted: expect.any(Number),
          mediaErrors: expect.any(Number),
        })
      );
    }, 120000);
  }
);
