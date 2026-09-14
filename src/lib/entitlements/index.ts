import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  adminEntitlements,
  subscriptions,
  type AdminEntitlement,
} from "@/lib/db/schema";
import { getBillingAccessMode } from "@/lib/platform-settings";
import {
  isAdminGrantActive,
  resolveEffectiveEntitlement,
  type AdminGrantSnapshot,
  type EffectiveEntitlement,
  type PaidSubscriptionSnapshot,
} from "./resolve";

export async function loadPaidSubscriptionSnapshot(
  userId: string
): Promise<PaidSubscriptionSnapshot | null> {
  const [sub] = await db
    .select({
      status: subscriptions.status,
      plan: subscriptions.plan,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      stripeCustomerId: subscriptions.stripeCustomerId,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!sub) {
    return null;
  }

  return {
    status: sub.status,
    plan: sub.plan,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    stripeBacked: Boolean(sub.stripeCustomerId || sub.stripeSubscriptionId),
  };
}

export function toAdminGrantSnapshot(
  grant: AdminEntitlement
): AdminGrantSnapshot {
  return {
    id: grant.id,
    isLifetime: grant.isLifetime,
    startsAt: grant.startsAt,
    expiresAt: grant.expiresAt,
    reason: grant.reason,
    grantedByAdminEmail: grant.grantedByAdminEmail,
  };
}

export async function loadActiveAdminGrant(
  userId: string,
  now: Date = new Date()
): Promise<AdminEntitlement | null> {
  const [grant] = await db
    .select()
    .from(adminEntitlements)
    .where(
      and(
        eq(adminEntitlements.userId, userId),
        eq(adminEntitlements.kind, "top_talent_unlock"),
        isNull(adminEntitlements.revokedAt)
      )
    )
    .orderBy(desc(adminEntitlements.createdAt))
    .limit(1);

  if (!grant) {
    return null;
  }

  if (!isAdminGrantActive(toAdminGrantSnapshot(grant), now)) {
    return grant;
  }

  return grant;
}

export async function getEffectiveEntitlement(
  userId: string,
  now: Date = new Date()
): Promise<EffectiveEntitlement> {
  const [billingAccessMode, paidSubscription, grantRow] = await Promise.all([
    getBillingAccessMode(),
    loadPaidSubscriptionSnapshot(userId),
    loadActiveAdminGrant(userId, now),
  ]);

  const adminGrant = grantRow ? toAdminGrantSnapshot(grantRow) : null;

  return resolveEffectiveEntitlement({
    billingAccessMode,
    paidSubscription,
    adminGrant,
    now,
  });
}

export {
  resolveEffectiveEntitlement,
  resolveAdminGrantWindow,
  isAdminGrantActive,
  isPaidSubscriptionActive,
  addUtcDays,
  type EffectiveEntitlement,
  type EntitlementSource,
  type PaidSubscriptionSnapshot,
  type AdminGrantSnapshot,
  type AdminGrantRequest,
  type ResolvedAdminGrantWindow,
} from "./resolve";
