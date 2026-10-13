import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  userNotificationPrefs,
  type UserNotificationPref,
} from "@/lib/db/schema";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/locale";
import type { Locale } from "@/lib/i18n/config";

export async function getLocaleFromCookie(): Promise<Locale> {
  try {
    const store = await cookies();
    return resolveLocale(store.get(LOCALE_COOKIE)?.value);
  } catch {
    return resolveLocale(null);
  }
}

export async function ensureNotificationPrefs(
  userId: string,
  localeOverride?: Locale
): Promise<UserNotificationPref> {
  const [existing] = await db
    .select()
    .from(userNotificationPrefs)
    .where(eq(userNotificationPrefs.userId, userId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const locale = localeOverride ?? (await getLocaleFromCookie());
  const [created] = await db
    .insert(userNotificationPrefs)
    .values({
      userId,
      emailEnabled: true,
      lineEnabled: true,
      locale,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  const [again] = await db
    .select()
    .from(userNotificationPrefs)
    .where(eq(userNotificationPrefs.userId, userId))
    .limit(1);

  if (!again) {
    throw new Error("Failed to create notification prefs");
  }
  return again;
}

export async function getNotificationPrefs(
  userId: string
): Promise<UserNotificationPref> {
  return ensureNotificationPrefs(userId);
}

export async function updateNotificationPrefs(input: {
  userId: string;
  emailEnabled?: boolean;
  lineEnabled?: boolean;
  locale?: Locale;
}): Promise<UserNotificationPref> {
  await ensureNotificationPrefs(input.userId);

  const patch: Partial<UserNotificationPref> = {
    updatedAt: new Date(),
  };
  if (input.emailEnabled !== undefined) {
    patch.emailEnabled = input.emailEnabled;
  }
  if (input.lineEnabled !== undefined) {
    patch.lineEnabled = input.lineEnabled;
  }
  if (input.locale !== undefined) {
    patch.locale = input.locale;
  }

  const [updated] = await db
    .update(userNotificationPrefs)
    .set(patch)
    .where(eq(userNotificationPrefs.userId, input.userId))
    .returning();

  return updated;
}
