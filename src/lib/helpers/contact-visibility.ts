export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "incomplete"
  | "trialing";

export type SubscriptionPlan = "free" | "top_talent_unlock";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
}

export function hasActiveSubscription(subscription: SubscriptionInfo | null): boolean {
  if (!subscription) {
    return false;
  }
  return subscription.status === "active" || subscription.status === "trialing";
}

export function hasTopTalentPlan(subscription: SubscriptionInfo | null): boolean {
  if (!subscription) {
    return false;
  }
  return subscription.plan === "top_talent_unlock";
}

/**
 * Whether the recruiter has a paid Top Talent plan (active or trialing).
 * This no longer grants contact-detail access — worker LINE/WhatsApp/phone
 * are never returned to recruiters. Premium access now means messaging Top
 * Talent, higher limits, priority, and Verified Pro badge entitlements.
 */
export function canAccessTopTalentContact(
  subscription: SubscriptionInfo | null
): boolean {
  return hasActiveSubscription(subscription) && hasTopTalentPlan(subscription);
}
