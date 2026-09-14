import { and, count, eq, gt, gte, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  adminEntitlements,
  profilePhotos,
  recruiterOpenings,
  subscriptions,
  users,
  workerProfiles,
} from "@/lib/db/schema";
import { getPlatformBillingSettings } from "@/lib/platform-settings";
import { isProfileTopTalent } from "@/lib/ranking";

export interface AdminOverviewMetrics {
  totalUsers: number;
  workers: number;
  recruiters: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  publishedWorkers: number;
  publishedOpenings: number;
  pendingVerifications: number;
  pendingPhotos: number;
  paidPremiumAccounts: number;
  adminGrantedPremiumAccounts: number;
  lifetimeGrants: number;
  billingAccessMode: "enforced" | "open_access";
  billingAccessModeLabel: "Enabled" | "Open Access";
  topTalentCount: number;
}

async function countWhere(
  table: typeof users | typeof workerProfiles | typeof recruiterOpenings | typeof profilePhotos | typeof subscriptions | typeof adminEntitlements,
  where?: ReturnType<typeof eq> | ReturnType<typeof and> | ReturnType<typeof gte>
): Promise<number> {
  const query = where
    ? db.select({ value: count() }).from(table).where(where)
    : db.select({ value: count() }).from(table);
  const [row] = await query;
  return row?.value ?? 0;
}

export async function getAdminOverviewMetrics(
  now: Date = new Date()
): Promise<AdminOverviewMetrics> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    workers,
    recruiters,
    newUsersLast7Days,
    newUsersLast30Days,
    publishedWorkers,
    publishedOpenings,
    pendingVerifications,
    pendingPhotos,
    paidPremiumAccounts,
    adminGrantedPremiumAccounts,
    lifetimeGrants,
    billing,
    publishedWorkerIds,
  ] = await Promise.all([
    countWhere(users),
    countWhere(users, eq(users.role, "worker")),
    countWhere(users, eq(users.role, "recruiter")),
    countWhere(users, gte(users.createdAt, sevenDaysAgo)),
    countWhere(users, gte(users.createdAt, thirtyDaysAgo)),
    countWhere(workerProfiles, eq(workerProfiles.isPublished, true)),
    countWhere(recruiterOpenings, eq(recruiterOpenings.isPublished, true)),
    countWhere(
      workerProfiles,
      eq(workerProfiles.verificationStatus, "pending")
    ),
    countWhere(profilePhotos, eq(profilePhotos.moderationStatus, "pending")),
    countWhere(
      subscriptions,
      and(
        eq(subscriptions.plan, "top_talent_unlock"),
        inArray(subscriptions.status, ["active", "trialing"])
      )
    ),
    db
      .select({ value: count() })
      .from(adminEntitlements)
      .where(
        and(
          isNull(adminEntitlements.revokedAt),
          or(
            eq(adminEntitlements.isLifetime, true),
            gt(adminEntitlements.expiresAt, now)
          )
        )
      )
      .then((rows) => rows[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(adminEntitlements)
      .where(
        and(
          eq(adminEntitlements.isLifetime, true),
          isNull(adminEntitlements.revokedAt)
        )
      )
      .then((rows) => rows[0]?.value ?? 0),
    getPlatformBillingSettings(),
    db
      .select({ id: workerProfiles.id })
      .from(workerProfiles)
      .where(eq(workerProfiles.isPublished, true)),
  ]);

  let topTalentCount = 0;
  for (const profile of publishedWorkerIds) {
    if (await isProfileTopTalent(profile.id)) {
      topTalentCount += 1;
    }
  }

  return {
    totalUsers,
    workers,
    recruiters,
    newUsersLast7Days,
    newUsersLast30Days,
    publishedWorkers,
    publishedOpenings,
    pendingVerifications,
    pendingPhotos,
    paidPremiumAccounts,
    adminGrantedPremiumAccounts,
    lifetimeGrants,
    billingAccessMode: billing.mode,
    billingAccessModeLabel:
      billing.mode === "open_access" ? "Open Access" : "Enabled",
    topTalentCount,
  };
}
