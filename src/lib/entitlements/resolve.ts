import type { BillingAccessMode } from "@/lib/db/schema";
import {
  canAccessTopTalentContact,
  type SubscriptionInfo,
} from "@/lib/helpers/contact-visibility";

export type EntitlementSource =
  | "paid_subscription"
  | "admin_grant"
  | "lifetime_admin_grant"
  | "open_access";

export interface PaidSubscriptionSnapshot extends SubscriptionInfo {
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  stripeBacked: boolean;
}

export interface AdminGrantSnapshot {
  id: string;
  isLifetime: boolean;
  startsAt: Date;
  expiresAt: Date | null;
  reason: string;
  grantedByAdminEmail: string;
}

export interface EffectiveEntitlement {
  hasPremiumAccess: boolean;
  sources: EntitlementSource[];
  billingAccessMode: BillingAccessMode;
  paidSubscription: PaidSubscriptionSnapshot | null;
  adminGrant: AdminGrantSnapshot | null;
  paidAccess: boolean;
  adminGrantAccess: boolean;
}

export function isAdminGrantActive(
  grant: AdminGrantSnapshot | null,
  now: Date = new Date()
): boolean {
  if (!grant) {
    return false;
  }
  if (grant.startsAt > now) {
    return false;
  }
  if (grant.isLifetime) {
    return true;
  }
  if (!grant.expiresAt) {
    return false;
  }
  return grant.expiresAt > now;
}

export function isPaidSubscriptionActive(
  subscription: PaidSubscriptionSnapshot | null
): boolean {
  if (!subscription) {
    return false;
  }
  return canAccessTopTalentContact(subscription);
}

/**
 * Canonical premium entitlement resolver.
 *
 * Open access is a paywall policy override only. It does not create, cancel,
 * or rewrite paid Stripe subscription rows, and it does not change Top Talent
 * ranking/status.
 */
export function resolveEffectiveEntitlement(input: {
  billingAccessMode: BillingAccessMode;
  paidSubscription: PaidSubscriptionSnapshot | null;
  adminGrant: AdminGrantSnapshot | null;
  now?: Date;
}): EffectiveEntitlement {
  const now = input.now ?? new Date();
  const paidAccess = isPaidSubscriptionActive(input.paidSubscription);
  const grantActive = isAdminGrantActive(input.adminGrant, now);
  const sources: EntitlementSource[] = [];

  if (input.billingAccessMode === "open_access") {
    sources.push("open_access");
  }
  if (paidAccess) {
    sources.push("paid_subscription");
  }
  if (grantActive && input.adminGrant?.isLifetime) {
    sources.push("lifetime_admin_grant");
  } else if (grantActive) {
    sources.push("admin_grant");
  }

  const hasPremiumAccess =
    input.billingAccessMode === "open_access" || paidAccess || grantActive;

  return {
    hasPremiumAccess,
    sources,
    billingAccessMode: input.billingAccessMode,
    paidSubscription: input.paidSubscription,
    adminGrant: grantActive ? input.adminGrant : input.adminGrant,
    paidAccess,
    adminGrantAccess: grantActive,
  };
}

export function addUtcDays(from: Date, days: number): Date {
  const next = new Date(from.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export type AdminGrantRequest =
  | { kind: "days"; days: number }
  | { kind: "lifetime" }
  | { kind: "custom"; expiresAt: Date };

export interface ResolvedAdminGrantWindow {
  startsAt: Date;
  expiresAt: Date | null;
  isLifetime: boolean;
  action: "grant" | "extend" | "lifetime";
  shortened: boolean;
}

/**
 * Compute the next admin-grant window.
 * Temporary extensions start from the later of now and the current expiry.
 * Lifetime is explicit (expiresAt = null). Existing grants are never shortened.
 */
export function resolveAdminGrantWindow(input: {
  now: Date;
  currentActiveGrant: AdminGrantSnapshot | null;
  requested: AdminGrantRequest;
}): ResolvedAdminGrantWindow {
  const now = input.now;
  const current = isAdminGrantActive(input.currentActiveGrant, now)
    ? input.currentActiveGrant
    : null;

  if (input.requested.kind === "lifetime") {
    return {
      startsAt: current?.startsAt ?? now,
      expiresAt: null,
      isLifetime: true,
      action: "lifetime",
      shortened: false,
    };
  }

  if (current?.isLifetime) {
    return {
      startsAt: current.startsAt,
      expiresAt: null,
      isLifetime: true,
      action: "extend",
      shortened: false,
    };
  }

  const currentExpiry =
    current?.expiresAt && current.expiresAt > now ? current.expiresAt : null;
  const base = currentExpiry ?? now;

  let requestedExpiry: Date;
  if (input.requested.kind === "days") {
    requestedExpiry = addUtcDays(base, input.requested.days);
  } else {
    requestedExpiry = input.requested.expiresAt;
    if (requestedExpiry <= now) {
      requestedExpiry = now;
    }
    if (currentExpiry && currentExpiry > requestedExpiry) {
      requestedExpiry = currentExpiry;
    }
  }

  return {
    startsAt: current?.startsAt ?? now,
    expiresAt: requestedExpiry,
    isLifetime: false,
    action: current ? "extend" : "grant",
    shortened: false,
  };
}
