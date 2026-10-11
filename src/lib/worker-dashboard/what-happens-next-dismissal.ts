export const WHAT_HAPPENS_NEXT_STORAGE_PREFIX =
  "paid-talent:what-happens-next-dismissed:";

export function whatHappensNextStorageKey(userId: string): string {
  return `${WHAT_HAPPENS_NEXT_STORAGE_PREFIX}${userId}`;
}

export function shouldShowWhatHappensNext(
  userId: string | undefined | null,
  dismissed: boolean
): boolean {
  return Boolean(userId) && !dismissed;
}

export function readWhatHappensNextDismissed(userId: string): boolean {
  if (typeof window === "undefined" || !userId) {
    return false;
  }

  try {
    return window.localStorage.getItem(whatHappensNextStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writeWhatHappensNextDismissed(userId: string): void {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  try {
    window.localStorage.setItem(whatHappensNextStorageKey(userId), "1");
  } catch {
    // Ignore quota / private-mode failures; the card can remain visible.
  }
}

export function workerHasPublishedContact(profile: {
  lineId?: string | null;
  whatsappNumber?: string | null;
  phoneNumber?: string | null;
} | null): boolean {
  if (!profile) {
    return false;
  }

  return Boolean(
    profile.lineId?.trim() ||
      profile.whatsappNumber?.trim() ||
      profile.phoneNumber?.trim()
  );
}
