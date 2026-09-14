/** @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { localDatabaseUrl } from "../../db/local-config";
import { parseDatabaseUrl } from "../../db/safety";
import { migrateLocalDb, startLocalDb } from "../../../../scripts/local-db";

const TEST_URL = localDatabaseUrl("test");
const shouldRun = process.env.RUN_DOCKER_DB_TESTS === "1";
const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const actorEmail = `ops-actor-${suffix}@example.com`;
const targetEmail = `ops-target-${suffix}@example.com`;
const recruiterEmail = `ops-recruiter-${suffix}@example.com`;
const bannedSignupEmail = `ops-banned-${suffix}@example.com`;

function isLocalTestDatabase(url: string | undefined): boolean {
  const parsed = parseDatabaseUrl(url);
  return (
    parsed.ok &&
    parsed.parsed.local &&
    parsed.parsed.database === "paid_talent_test"
  );
}

describe.skipIf(!shouldRun)("admin operations against local test Postgres", () => {
  let createUserWithRole: typeof import("../../auth/create-account").createUserWithRole;
  let moderateAccount: typeof import("../account-moderation").moderateAccount;
  let searchAdminUsers: typeof import("../users").searchAdminUsers;
  let getAdminOverviewMetrics: typeof import("../overview-metrics").getAdminOverviewMetrics;
  let upsertAdminEntitlement: typeof import("../../entitlements/grants").upsertAdminEntitlement;
  let revokeAdminEntitlement: typeof import("../../entitlements/grants").revokeAdminEntitlement;
  let getEffectiveEntitlement: typeof import("../../entitlements").getEffectiveEntitlement;
  let updateBillingAccessMode: typeof import("../../platform-settings").updateBillingAccessMode;
  let getBillingAccessMode: typeof import("../../platform-settings").getBillingAccessMode;
  let invalidateBillingAccessModeCache: typeof import("../../platform-settings").invalidateBillingAccessModeCache;
  let db: typeof import("../../db").db;
  let subscriptions: typeof import("../../db").subscriptions;
  let adminAuditEvents: typeof import("../../db").adminAuditEvents;

  let actorId = "";
  let targetId = "";
  let recruiterId = "";

  beforeAll(async () => {
    await startLocalDb("test");
    await migrateLocalDb("test");
    process.env.DATABASE_URL = TEST_URL;
    expect(isLocalTestDatabase(process.env.DATABASE_URL)).toBe(true);
    vi.resetModules();
    vi.doUnmock("@/lib/db");
    ({ createUserWithRole } = await import("../../auth/create-account"));
    ({ moderateAccount } = await import("../account-moderation"));
    ({ searchAdminUsers } = await import("../users"));
    ({ getAdminOverviewMetrics } = await import("../overview-metrics"));
    ({ upsertAdminEntitlement, revokeAdminEntitlement } = await import(
      "../../entitlements/grants"
    ));
    ({ getEffectiveEntitlement } = await import("../../entitlements"));
    ({
      updateBillingAccessMode,
      getBillingAccessMode,
      invalidateBillingAccessModeCache,
    } = await import("../../platform-settings"));
    ({ db, subscriptions, adminAuditEvents } = await import("../../db"));

    const actor = await createUserWithRole({
      email: actorEmail,
      name: "Ops Actor",
      role: "recruiter",
      ageVerified: true,
    });
    const target = await createUserWithRole({
      email: targetEmail,
      name: "Ops Target",
      role: "worker",
      ageVerified: true,
    });
    const recruiter = await createUserWithRole({
      email: recruiterEmail,
      name: "Ops Recruiter",
      role: "recruiter",
      ageVerified: true,
    });
    actorId = actor.id;
    targetId = target.id;
    recruiterId = recruiter.id;
  }, 120000);

  afterAll(async () => {
    const client = postgres(TEST_URL, {
      max: 1,
      connect_timeout: 5,
      onnotice: () => undefined,
    });
    try {
      await client`
        DELETE FROM users
        WHERE email IN (${actorEmail}, ${targetEmail}, ${recruiterEmail}, ${bannedSignupEmail})
      `;
      await client`
        UPDATE platform_settings
        SET billing_access_mode = 'enforced'
        WHERE id = 'default'
      `;
    } catch {
      // Test DB may be unavailable.
    } finally {
      await client.end({ timeout: 5 });
    }
  });

  it("searches users by email, name, and id", async () => {
    const byEmail = await searchAdminUsers({ query: targetEmail, page: 1 });
    expect(byEmail.users.map((user) => user.email)).toContain(targetEmail);

    const byName = await searchAdminUsers({ query: "Ops Target", page: 1 });
    expect(byName.users.map((user) => user.id)).toContain(targetId);

    const byId = await searchAdminUsers({ query: targetId, page: 1 });
    expect(byId.users).toHaveLength(1);
    expect(byId.users[0]?.id).toBe(targetId);
    expect(byId.page).toBe(1);
  });

  it("reads overview metrics from the database", async () => {
    const metrics = await getAdminOverviewMetrics();
    expect(metrics.totalUsers).toBeGreaterThanOrEqual(3);
    expect(metrics.workers).toBeGreaterThanOrEqual(1);
    expect(metrics.recruiters).toBeGreaterThanOrEqual(2);
    expect(["enforced", "open_access"]).toContain(metrics.billingAccessMode);
  });

  it("rejects self-suspend and requires a reason", async () => {
    const self = await moderateAccount({
      action: "suspend",
      targetUserId: actorId,
      reason: "trying to suspend myself",
      actorUserId: actorId,
      actorEmail: actorEmail,
    });
    expect(self.ok).toBe(false);
    if (!self.ok) {
      expect(self.status).toBe(400);
    }

    const noReason = await moderateAccount({
      action: "suspend",
      targetUserId: targetId,
      reason: "no",
      actorUserId: actorId,
      actorEmail: actorEmail,
    });
    expect(noReason.ok).toBe(false);
  });

  it("suspends, reactivates, bans, and lifts a durable identity ban", async () => {
    const suspended = await moderateAccount({
      action: "suspend",
      targetUserId: targetId,
      reason: "temporary abuse review",
      actorUserId: actorId,
      actorEmail: actorEmail,
    });
    expect(suspended).toEqual({ ok: true, accountStatus: "suspended" });

    const reactivated = await moderateAccount({
      action: "reactivate",
      targetUserId: targetId,
      reason: "review complete",
      actorUserId: actorId,
      actorEmail: actorEmail,
    });
    expect(reactivated).toEqual({ ok: true, accountStatus: "active" });

    const banned = await moderateAccount({
      action: "ban",
      targetUserId: targetId,
      reason: "repeat identity abuse",
      actorUserId: actorId,
      actorEmail: actorEmail,
    });
    expect(banned).toEqual({ ok: true, accountStatus: "banned" });

    await expect(
      createUserWithRole({
        email: targetEmail,
        name: "Clone",
        role: "worker",
        ageVerified: true,
      })
    ).rejects.toThrow(/banned/);

    await expect(
      createUserWithRole({
        email: bannedSignupEmail,
        name: "Unrelated",
        role: "worker",
        ageVerified: true,
      })
    ).resolves.toMatchObject({ email: bannedSignupEmail });

    const lifted = await moderateAccount({
      action: "lift_ban",
      targetUserId: targetId,
      reason: "appeal accepted",
      actorUserId: actorId,
      actorEmail: actorEmail,
    });
    expect(lifted).toEqual({ ok: true, accountStatus: "active" });

    const events = await db
      .select({ action: adminAuditEvents.action })
      .from(adminAuditEvents)
      .where(eq(adminAuditEvents.targetUserId, targetId));
    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "account_suspended",
        "account_reactivated",
        "account_banned",
        "ban_lifted",
      ])
    );
  });

  it("grants, extends, and revokes admin premium without touching paid rows", async () => {
    const now = new Date("2026-09-14T12:00:00.000Z");
    await db.insert(subscriptions).values({
      userId: recruiterId,
      status: "active",
      plan: "top_talent_unlock",
      stripeCustomerId: `cus_ops_${suffix}`,
      stripeSubscriptionId: `sub_ops_${suffix}`,
      currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
      createdAt: now,
      updatedAt: now,
    });

    const seven = await upsertAdminEntitlement({
      userId: recruiterId,
      requested: { kind: "days", days: 7 },
      reason: "support goodwill",
      adminEmail: actorEmail,
      now,
    });
    expect(seven.action).toBe("grant");
    expect(seven.grant.isLifetime).toBe(false);
    expect(seven.grant.expiresAt?.toISOString()).toBe("2026-09-21T12:00:00.000Z");

    const fourteen = await upsertAdminEntitlement({
      userId: recruiterId,
      requested: { kind: "days", days: 14 },
      reason: "extend support",
      adminEmail: actorEmail,
      now,
    });
    expect(fourteen.action).toBe("extend");
    expect(fourteen.grant.expiresAt?.toISOString()).toBe(
      "2026-10-05T12:00:00.000Z"
    );

    const thirty = await upsertAdminEntitlement({
      userId: recruiterId,
      requested: { kind: "days", days: 30 },
      reason: "longer support",
      adminEmail: actorEmail,
      now,
    });
    expect(thirty.grant.expiresAt?.toISOString()).toBe("2026-11-04T12:00:00.000Z");

    const custom = await upsertAdminEntitlement({
      userId: recruiterId,
      requested: { kind: "custom", expiresAt: new Date("2026-11-01T12:00:00.000Z") },
      reason: "custom expiry should not shorten",
      adminEmail: actorEmail,
      now,
    });
    expect(custom.grant.expiresAt?.toISOString()).toBe("2026-11-04T12:00:00.000Z");

    const lifetime = await upsertAdminEntitlement({
      userId: recruiterId,
      requested: { kind: "lifetime" },
      reason: "partner lifetime",
      adminEmail: actorEmail,
      now,
    });
    expect(lifetime.action).toBe("lifetime");
    expect(lifetime.grant.isLifetime).toBe(true);
    expect(lifetime.grant.expiresAt).toBeNull();

    await revokeAdminEntitlement({
      userId: recruiterId,
      adminEmail: actorEmail,
      reason: "grant no longer needed",
      now,
    });

    const [paid] = await db
      .select({
        status: subscriptions.status,
        plan: subscriptions.plan,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, recruiterId));
    expect(paid).toEqual({
      status: "active",
      plan: "top_talent_unlock",
      stripeSubscriptionId: `sub_ops_${suffix}`,
    });

    invalidateBillingAccessModeCache();
    const entitlement = await getEffectiveEntitlement(recruiterId, now);
    expect(entitlement.paidAccess).toBe(true);
    expect(entitlement.adminGrantAccess).toBe(false);
    expect(entitlement.hasPremiumAccess).toBe(true);
  });

  it("persists open access without rewriting paid subscriptions", async () => {
    invalidateBillingAccessModeCache();
    const previous = await getBillingAccessMode();
    const opened = await updateBillingAccessMode({
      nextMode: "open_access",
      previousMode: previous,
      reason: "launch without paywall",
      adminEmail: actorEmail,
    });
    expect(opened).toEqual({ ok: true, mode: "open_access" });

    invalidateBillingAccessModeCache();
    expect(await getBillingAccessMode()).toBe("open_access");

    const [paid] = await db
      .select({
        status: subscriptions.status,
        plan: subscriptions.plan,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, recruiterId));
    expect(paid).toEqual({
      status: "active",
      plan: "top_talent_unlock",
    });

    const stale = await updateBillingAccessMode({
      nextMode: "enforced",
      previousMode: "enforced",
      reason: "stale confirmation",
      adminEmail: actorEmail,
    });
    expect(stale.ok).toBe(false);

    const closed = await updateBillingAccessMode({
      nextMode: "enforced",
      previousMode: "open_access",
      reason: "restore paywall",
      adminEmail: actorEmail,
    });
    expect(closed).toEqual({ ok: true, mode: "enforced" });
    invalidateBillingAccessModeCache();
    expect(await getBillingAccessMode()).toBe("enforced");
  });
});
