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

export interface ContactVisibilityResult {
  canViewContact: boolean;
  reason: "own_profile" | "has_subscription" | "not_top_talent" | "subscription_required";
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

export function canAccessTopTalentContact(
  subscription: SubscriptionInfo | null
): boolean {
  return hasActiveSubscription(subscription) && hasTopTalentPlan(subscription);
}

export function determineContactVisibility(
  isTopTalent: boolean,
  subscription: SubscriptionInfo | null,
  hasPremiumAccess?: boolean
): ContactVisibilityResult {
  if (!isTopTalent) {
    return {
      canViewContact: true,
      reason: "not_top_talent",
    };
  }

  if (hasPremiumAccess === true || canAccessTopTalentContact(subscription)) {
    return {
      canViewContact: true,
      reason: "has_subscription",
    };
  }

  return {
    canViewContact: false,
    reason: "subscription_required",
  };
}

export interface ContactVisibilityParams {
  isOwnProfile: boolean;
  isTopTalent: boolean;
  subscription: SubscriptionInfo | null;
  hasPremiumAccess?: boolean;
}

/**
 * Enhanced contact visibility check that also considers profile ownership.
 * Workers viewing their own profile always have contact visibility.
 */
export function determineContactVisibilityWithOwnership(
  params: ContactVisibilityParams
): ContactVisibilityResult {
  const { isOwnProfile, isTopTalent, subscription } = params;

  if (isOwnProfile) {
    return {
      canViewContact: true,
      reason: "own_profile",
    };
  }

  return determineContactVisibility(
    isTopTalent,
    subscription,
    params.hasPremiumAccess
  );
}

/**
 * Simple boolean check for contact visibility (for API use).
 * Considers: own profile, subscription status, and Top Talent status.
 */
export function canViewContactDetails(params: ContactVisibilityParams): boolean {
  return determineContactVisibilityWithOwnership(params).canViewContact;
}

export function getVisibleContactFields(
  isTopTalent: boolean,
  subscription: SubscriptionInfo | null
): string[] {
  const { canViewContact } = determineContactVisibility(isTopTalent, subscription);

  if (canViewContact) {
    return ["lineId", "whatsappNumber", "phoneNumber", "contactEmail"];
  }

  return [];
}

export function maskContactField(value: string | null, visible: boolean): string | null {
  if (!value) {
    return null;
  }

  if (visible) {
    return value;
  }

  if (value.length <= 4) {
    return "****";
  }

  return value.substring(0, 2) + "****" + value.substring(value.length - 2);
}
