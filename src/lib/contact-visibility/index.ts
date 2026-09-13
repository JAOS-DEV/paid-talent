/**
 * Contact Visibility Rules for Paid Talent
 *
 * Visibility Logic:
 * | Condition                                          | Can View Contact |
 * |---------------------------------------------------|------------------|
 * | Viewer is the worker themselves                    | ✅ Yes           |
 * | Viewer has active Top Talent subscription          | ✅ Yes           |
 * | Worker is Top Talent AND viewer has no subscription| ❌ No (locked)   |
 * | Worker is NOT Top Talent                           | ✅ Yes           |
 */

export interface ContactVisibilityParams {
  isOwnProfile: boolean;
  viewerHasTopTalentAccess: boolean;
  profileIsTopTalent: boolean;
}

/**
 * Determines if a viewer can see contact details for a worker profile.
 * This is a pure function that encapsulates the business rules.
 */
export function canViewContact(params: ContactVisibilityParams): boolean {
  const { isOwnProfile, viewerHasTopTalentAccess, profileIsTopTalent } = params;

  if (isOwnProfile) {
    return true;
  }

  if (viewerHasTopTalentAccess) {
    return true;
  }

  if (!profileIsTopTalent) {
    return true;
  }

  return false;
}

/**
 * Determines if the contact section should show a lock icon/state.
 */
export function isContactLocked(params: ContactVisibilityParams): boolean {
  return !canViewContact(params);
}

/**
 * Determines if the "Unlock" CTA should be shown.
 * Only show Unlock when:
 * - Contact is locked
 * - Profile is Top Talent
 * - Viewer is not the profile owner
 */
export function shouldShowUnlockCTA(params: ContactVisibilityParams): boolean {
  const { isOwnProfile, viewerHasTopTalentAccess, profileIsTopTalent } = params;

  if (isOwnProfile) {
    return false;
  }

  if (viewerHasTopTalentAccess) {
    return false;
  }

  return profileIsTopTalent;
}

/**
 * Determines if the "Express Interest" button should be available.
 * Interest can only be expressed if:
 * - Not own profile
 * - Contact is visible (not locked) OR user has top talent access
 *
 * For Top Talent profiles without access, interest is gated the same as contact.
 */
export function canExpressInterest(
  params: ContactVisibilityParams & { alreadyExpressed: boolean }
): {
  allowed: boolean;
  reason?: "own_profile" | "already_expressed" | "contact_locked";
} {
  const { isOwnProfile, alreadyExpressed } = params;

  if (isOwnProfile) {
    return { allowed: false, reason: "own_profile" };
  }

  if (alreadyExpressed) {
    return { allowed: false, reason: "already_expressed" };
  }

  if (!canViewContact(params)) {
    return { allowed: false, reason: "contact_locked" };
  }

  return { allowed: true };
}
