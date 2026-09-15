export const VERIFIED_BANNER_STORAGE_PREFIX =
  "paid-talent:verified-banner-dismissed:";

export function verifiedBannerStorageKey(userId: string): string {
  return `${VERIFIED_BANNER_STORAGE_PREFIX}${userId}`;
}

export function isVerifiedLiveSuccessState(
  status: string,
  isPublished: boolean
): boolean {
  return status === "verified" && isPublished;
}

export function readVerifiedBannerDismissed(userId: string): boolean {
  if (typeof window === "undefined" || !userId) {
    return false;
  }

  try {
    return window.localStorage.getItem(verifiedBannerStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writeVerifiedBannerDismissed(userId: string): void {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  try {
    window.localStorage.setItem(verifiedBannerStorageKey(userId), "1");
  } catch {
    // Ignore quota / private-mode failures; the banner can remain visible.
  }
}
