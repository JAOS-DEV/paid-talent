import { and, count, eq, inArray, sql } from "drizzle-orm";
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
import { countPublishedTopTalent } from "@/lib/ranking/published-top-talent";

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

function toCount(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

export async function getAdminOverviewMetrics(
  now: Date = new Date()
): Promise<AdminOverviewMetrics> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();
  const nowIso = now.toISOString();

  const [
    userCounts,
    workerCounts,
    publishedOpenings,
    pendingPhotos,
    paidPremiumAccounts,
    entitlementCounts,
    billing,
    topTalentCount,
  ] = await Promise.all([
    db
      .select({
        totalUsers: count(),
        workers: sql<number>`count(*) filter (where ${users.role} = 'worker')::int`,
        recruiters: sql<number>`count(*) filter (where ${users.role} = 'recruiter')::int`,
        newUsersLast7Days: sql<number>`count(*) filter (where ${users.createdAt} >= ${sevenDaysAgoIso}::timestamptz)::int`,
        newUsersLast30Days: sql<number>`count(*) filter (where ${users.createdAt} >= ${thirtyDaysAgoIso}::timestamptz)::int`,
      })
      .from(users)
      .then((rows) => rows[0]),
    db
      .select({
        publishedWorkers: sql<number>`count(*) filter (where ${workerProfiles.isPublished} = true)::int`,
        pendingVerifications: sql<number>`count(*) filter (where ${workerProfiles.verificationStatus} = 'pending')::int`,
      })
      .from(workerProfiles)
      .then((rows) => rows[0]),
    db
      .select({ value: count() })
      .from(recruiterOpenings)
      .where(eq(recruiterOpenings.isPublished, true))
      .then((rows) => rows[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(profilePhotos)
      .where(eq(profilePhotos.moderationStatus, "pending"))
      .then((rows) => rows[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.plan, "top_talent_unlock"),
          inArray(subscriptions.status, ["active", "trialing"])
        )
      )
      .then((rows) => rows[0]?.value ?? 0),
    db
      .select({
        adminGrantedPremiumAccounts: sql<number>`count(*) filter (where ${adminEntitlements.revokedAt} is null and (${adminEntitlements.isLifetime} = true or ${adminEntitlements.expiresAt} > ${nowIso}::timestamptz))::int`,
        lifetimeGrants: sql<number>`count(*) filter (where ${adminEntitlements.isLifetime} = true and ${adminEntitlements.revokedAt} is null)::int`,
      })
      .from(adminEntitlements)
      .then((rows) => rows[0]),
    getPlatformBillingSettings(),
    countPublishedTopTalent(now),
  ]);

  return {
    totalUsers: toCount(userCounts?.totalUsers),
    workers: toCount(userCounts?.workers),
    recruiters: toCount(userCounts?.recruiters),
    newUsersLast7Days: toCount(userCounts?.newUsersLast7Days),
    newUsersLast30Days: toCount(userCounts?.newUsersLast30Days),
    publishedWorkers: toCount(workerCounts?.publishedWorkers),
    publishedOpenings,
    pendingVerifications: toCount(workerCounts?.pendingVerifications),
    pendingPhotos,
    paidPremiumAccounts,
    adminGrantedPremiumAccounts: toCount(
      entitlementCounts?.adminGrantedPremiumAccounts
    ),
    lifetimeGrants: toCount(entitlementCounts?.lifetimeGrants),
    billingAccessMode: billing.mode,
    billingAccessModeLabel:
      billing.mode === "open_access" ? "Open Access" : "Enabled",
    topTalentCount,
  };
}
