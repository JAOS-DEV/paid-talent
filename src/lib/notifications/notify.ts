import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  notifications,
  userNotificationPrefs,
  users,
  type Notification,
  type NotificationType,
} from "@/lib/db/schema";
import { getMessagingSettings } from "@/lib/messaging/settings";
import { getNotificationChannels } from "@/lib/notifications/channels";
import { renderNotification } from "@/lib/notifications/render";
import { resolveLocale } from "@/lib/i18n/locale";

const MAX_ATTEMPTS = 3;
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

function scheduleDeliver(notificationId: string): void {
  const run = (): void => {
    void deliver(notificationId).catch((error) => {
      console.error("[notifications] deliver failed", {
        notificationId,
        error,
      });
    });
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { after } = require("next/server") as {
      after?: (fn: () => void) => void;
    };
    if (typeof after === "function") {
      after(run);
      return;
    }
  } catch {
    // Tests / non-Next contexts: fall through
  }

  // Non-awaited so callers are never blocked
  void Promise.resolve().then(run);
}

export async function notify(
  userId: string,
  type: NotificationType,
  payload: Record<string, string>,
  options?: { dedupeKey?: string }
): Promise<Notification | null> {
  try {
    const [row] = await db
      .insert(notifications)
      .values({
        userId,
        type,
        payload,
        dedupeKey: options?.dedupeKey ?? null,
        emailStatus: "pending",
        lineStatus: "pending",
        attempts: 0,
        createdAt: new Date(),
      })
      .returning();

    scheduleDeliver(row.id);
    return row;
  } catch (error) {
    console.error("[notifications] notify insert failed", { userId, type, error });
    return null;
  }
}

async function markChannelStatuses(
  id: string,
  patch: Partial<Notification>
): Promise<void> {
  await db
    .update(notifications)
    .set(patch)
    .where(eq(notifications.id, id));
}

export async function deliver(notificationId: string): Promise<void> {
  try {
    const [row] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (!row) return;

    const [user] = await db
      .select({
        role: users.role,
        accountStatus: users.accountStatus,
      })
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);

    const [prefs] = await db
      .select()
      .from(userNotificationPrefs)
      .where(eq(userNotificationPrefs.userId, row.userId))
      .limit(1);

    const locale = resolveLocale(prefs?.locale ?? null);
    const role =
      user?.role === "recruiter" || user?.role === "worker"
        ? user.role
        : undefined;
    const rendered = renderNotification(row.type, row.payload, locale, {
      role,
    });

    // Throttle external delivery for new_message when a recent unread
    // notification with the same dedupe key was already sent externally.
    if (row.type === "new_message" && row.dedupeKey) {
      const settings = await getMessagingSettings();
      const cooldownMs = settings.notifyCooldownMinutes * 60 * 1000;
      const since = new Date(Date.now() - cooldownMs);

      const [recent] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, row.userId),
            eq(notifications.dedupeKey, row.dedupeKey),
            sql`${notifications.id} <> ${row.id}`,
            isNull(notifications.readAt),
            sql`${notifications.createdAt} >= ${since}`,
            or(
              eq(notifications.emailStatus, "sent"),
              eq(notifications.lineStatus, "sent")
            )
          )
        )
        .limit(1);

      if (recent) {
        await markChannelStatuses(row.id, {
          emailStatus: "skipped",
          lineStatus: "skipped",
          lastError: "throttled",
        });
        return;
      }
    }

    const channels = getNotificationChannels();
    let delivered = false;
    let lastError: string | null = null;
    let attempted = false;

    const emailPatch: Partial<Notification> = {};
    const linePatch: Partial<Notification> = {};

    for (const channel of channels) {
      const statusKey =
        channel.name === "email" ? "emailStatus" : "lineStatus";
      const sentAtKey =
        channel.name === "email" ? "emailSentAt" : "lineSentAt";

      if (delivered) {
        if (channel.name === "email") {
          emailPatch.emailStatus = "skipped";
        } else {
          linePatch.lineStatus = "skipped";
        }
        continue;
      }

      if (!channel.isConfigured()) {
        if (channel.name === "email") {
          emailPatch.emailStatus = "skipped";
          emailPatch.lastError = "not_configured";
        } else {
          linePatch.lineStatus = "skipped";
          linePatch.lastError = "not_configured";
        }
        continue;
      }

      const can = await channel.canDeliverTo(row.userId);
      if (!can.ok) {
        if (channel.name === "email") {
          emailPatch.emailStatus = "skipped";
          emailPatch.lastError = can.reason ?? "cannot_deliver";
        } else {
          linePatch.lineStatus = "skipped";
          linePatch.lastError = can.reason ?? "cannot_deliver";
        }
        continue;
      }

      attempted = true;
      const result = await channel.send(row.userId, rendered);
      if (result.ok) {
        delivered = true;
        if (channel.name === "email") {
          emailPatch.emailStatus = "sent";
          emailPatch.emailSentAt = new Date();
        } else {
          linePatch.lineStatus = "sent";
          linePatch.lineSentAt = new Date();
        }
      } else {
        lastError = result.error;
        if (channel.name === "email") {
          emailPatch.emailStatus = "failed";
        } else {
          linePatch.lineStatus = "failed";
        }
      }

      void statusKey;
      void sentAtKey;
    }

    // Channels not in the list (e.g. LINE before next PR) stay skipped
    if (!channels.some((c) => c.name === "line")) {
      linePatch.lineStatus = linePatch.lineStatus ?? "skipped";
    }
    if (!channels.some((c) => c.name === "email")) {
      emailPatch.emailStatus = emailPatch.emailStatus ?? "skipped";
    }

    const attempts =
      attempted && !delivered ? row.attempts + 1 : row.attempts;

    await markChannelStatuses(row.id, {
      ...emailPatch,
      ...linePatch,
      attempts,
      lastError:
        delivered
          ? null
          : lastError ??
            emailPatch.lastError ??
            linePatch.lastError ??
            row.lastError,
    });
  } catch (error) {
    console.error("[notifications] deliver error", { notificationId, error });
    try {
      await db
        .update(notifications)
        .set({
          attempts: sql`${notifications.attempts} + 1`,
          lastError:
            error instanceof Error ? error.message : "deliver_failed",
          emailStatus: "failed",
        })
        .where(eq(notifications.id, notificationId));
    } catch {
      // swallow
    }
  }
}

export async function retryPending(now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - RETRY_WINDOW_MS);

  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        or(
          inArray(notifications.emailStatus, ["pending", "failed"]),
          inArray(notifications.lineStatus, ["pending", "failed"])
        ),
        lt(notifications.attempts, MAX_ATTEMPTS),
        sql`${notifications.createdAt} >= ${since}`
      )
    );

  for (const row of rows) {
    await deliver(row.id);
  }

  return rows.length;
}

export async function listNotificationsForUser(
  userId: string,
  limit = 50
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(sql`${notifications.createdAt} desc`)
    .limit(limit);

  const [unread] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt))
    );

  return {
    notifications: rows,
    unreadCount: Number(unread?.value ?? 0),
  };
}

export async function markNotificationsRead(input: {
  userId: string;
  ids?: string[];
  all?: boolean;
}): Promise<number> {
  const now = new Date();

  if (input.all) {
    const updated = await db
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(notifications.userId, input.userId),
          isNull(notifications.readAt)
        )
      )
      .returning({ id: notifications.id });
    return updated.length;
  }

  if (!input.ids?.length) {
    return 0;
  }

  const updated = await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.userId, input.userId),
        inArray(notifications.id, input.ids),
        isNull(notifications.readAt)
      )
    )
    .returning({ id: notifications.id });

  return updated.length;
}
