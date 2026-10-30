import { eq } from "drizzle-orm";
import { db, subscriptions } from "@/lib/db";
import type { BillingAccessMode, BillingProduct } from "@/lib/db/schema";
import { getEffectiveEntitlement } from "@/lib/entitlements";
import { getRecruiterAccess } from "@/lib/recruiter-access";
import { isStripeConfigured } from "@/lib/stripe";

export type BillingPlanKey =
  | "none"
  | "monthly"
  | "annual"
  | "pass_7d"
  | "admin_grant";

export interface RecruiterBillingFacts {
  isVerified: boolean;
  stripeConfigured: boolean;
  hasStripeCustomer: boolean;
  billingAccessMode: BillingAccessMode;
  paidAccess: boolean;
  passAccess: boolean;
  adminGrantAccess: boolean;
  subscriptionStatus: string | null;
  billingProduct: BillingProduct | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  passExpiresAt: string | null;
  grantExpiresAt: string | null;
  grantLifetime: boolean;
}

export interface RecruiterBillingView {
  hasPlan: boolean;
  plan: BillingPlanKey;
  status: string;
  renewalAt: string | null;
  expiresAt: string | null;
  showRenewal: boolean;
  showExpiry: boolean;
  showManage: boolean;
  showSubscribe: boolean;
  openAccess: boolean;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/**
 * What the billing page shows. A 7-day pass shows expiry and never a renewal date.
 */
export function presentRecruiterBilling(
  facts: RecruiterBillingFacts
): RecruiterBillingView {
  const recurring =
    facts.paidAccess &&
    facts.billingProduct !== "pass_7d" &&
    (facts.billingProduct === "monthly" || facts.billingProduct === "annual");

  let plan: BillingPlanKey = "none";
  let status = facts.billingAccessMode === "open_access" ? "open_access" : "none";
  let renewalAt: string | null = null;
  let expiresAt: string | null = null;
  let showRenewal = false;
  let showExpiry = false;
  let hasPlan = false;

  if (facts.passAccess && !recurring) {
    plan = "pass_7d";
    status = "active";
    expiresAt = facts.passExpiresAt;
    showExpiry = true;
    hasPlan = true;
  } else if (facts.paidAccess) {
    plan = facts.billingProduct === "annual" ? "annual" : "monthly";
    status = facts.subscriptionStatus ?? "active";
    hasPlan = true;
    if (facts.cancelAtPeriodEnd) {
      expiresAt = facts.currentPeriodEnd;
      showExpiry = Boolean(facts.currentPeriodEnd);
    } else {
      renewalAt = facts.currentPeriodEnd;
      showRenewal = Boolean(facts.currentPeriodEnd);
    }
  } else if (facts.adminGrantAccess) {
    plan = "admin_grant";
    status = "active";
    hasPlan = true;
    if (!facts.grantLifetime) {
      expiresAt = facts.grantExpiresAt;
      showExpiry = Boolean(facts.grantExpiresAt);
    }
  }

  return {
    hasPlan,
    plan,
    status,
    renewalAt,
    expiresAt,
    showRenewal,
    showExpiry,
    showManage:
      facts.stripeConfigured && facts.hasStripeCustomer && facts.isVerified,
    showSubscribe: !hasPlan && facts.billingAccessMode !== "open_access",
    openAccess: facts.billingAccessMode === "open_access",
  };
}

export async function getRecruiterBillingSummary(
  userId: string
): Promise<RecruiterBillingView> {
  const [access, entitlement, subRows] = await Promise.all([
    getRecruiterAccess(userId),
    getEffectiveEntitlement(userId),
    db
      .select({
        status: subscriptions.status,
        billingProduct: subscriptions.billingProduct,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        stripeCustomerId: subscriptions.stripeCustomerId,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1),
  ]);

  const sub = subRows[0] ?? null;

  return presentRecruiterBilling({
    isVerified: access.isVerified,
    stripeConfigured: isStripeConfigured(),
    hasStripeCustomer: Boolean(sub?.stripeCustomerId),
    billingAccessMode: entitlement.billingAccessMode,
    paidAccess: entitlement.paidAccess,
    passAccess: entitlement.passAccess,
    adminGrantAccess: entitlement.adminGrantAccess,
    subscriptionStatus: sub?.status ?? entitlement.paidSubscription?.status ?? null,
    billingProduct: sub?.billingProduct ?? null,
    currentPeriodEnd: iso(
      sub?.currentPeriodEnd ?? entitlement.paidSubscription?.currentPeriodEnd
    ),
    cancelAtPeriodEnd:
      sub?.cancelAtPeriodEnd ??
      entitlement.paidSubscription?.cancelAtPeriodEnd ??
      false,
    passExpiresAt: iso(entitlement.activePass?.expiresAt),
    grantExpiresAt: iso(entitlement.adminGrant?.expiresAt),
    grantLifetime: entitlement.adminGrant?.isLifetime === true,
  });
}
