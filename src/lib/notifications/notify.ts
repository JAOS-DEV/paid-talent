import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import * as NextServer from "next/server";
import { db } from "@/lib/db";
import {
  notifications,
  userNotificationPrefs,
  users,
  type DeliveryStatus,
  type Notification,
  type NotificationType,
} from "@/lib/db/schema";
import { getMessagingSettings } from "@/lib/messaging/settings";
import { getNotificationChannels } from "@/lib/notifications/channels";
import { renderNotification } from "@/lib/notifications/render";
import { resolveLocale } from "@/lib/i18n/locale";

const MAX_ATTEMPTS = 3;
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
const CLAIM_LEASE_INTERVAL = sql`now() - interval '5 minutes'`;
const RETRYABLE_STATUSES: DeliveryStatus[] = ["pending", "failed"];

type AfterFn = (fn: () => unknown | Promise<unknown>) => void;

function resolveAfter(): AfterFn | undefined {
  const after = (NextServer as { after?: AfterFn }).after;
  return typeof after === "function" ? after : undefined;
}

function isRetryableStatus(status: DeliveryStatus): boolean {
  return status === "pending" || status === "failed";
}

function claimAvailable(): ReturnType<typeof or> {
  return or(
    isNull(notifications.claimedAt),
    lt(notifications.claimedAt, CLAIM_LEASE_INTERVAL)
  );
}

export function scheduleDeliver(notificationId: string): void {
  const run = (): Promise<void> =>
    deliver(notificationId).catch((error) => {
      console.error("[notifications] deliver failed", {
        notificationId,
        error,
      });
    });

  const after = resolveAfter();
  if (after) {
    after(run);
    return;
  }

  // Non-Next / tests without after: fire-and-forget
  void run();
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
    .set({ ...patch, claimedAt: null })
    .where(eq(notifications.id, id));
}

export async function deliver(notificationId: string): Promise<void> {
  try {
    // Lease-based claim: concurrent UPDATEs re-check WHERE after row lock;
    // the loser sees claimedAt set and does not match.
    const [row] = await db
      .update(notifications)
      .set({
        claimedAt: sql`now()`,
        lastError: null,
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          or(
            inArray(notifications.emailStatus, RETRYABLE_STATUSES),
            inArray(notifications.lineStatus, RETRYABLE_STATUSES)
          ),
          lt(notifications.attempts, MAX_ATTEMPTS),
          claimAvailable()
        )
      )
      .returning();

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
      const currentStatus =
        channel.name === "email" ? row.emailStatus : row.lineStatus;

      // Never resend a channel that already succeeded (or was skipped).
      if (!isRetryableStatus(currentStatus)) {
        continue;
      }

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
      const rendered = renderNotification(row.type, row.payload, locale, {
        role,
        channel: channel.name,
      });
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
    }

    // Channels not in the list (e.g. LINE before next PR) stay skipped
    // when they were still retryable on the claimed row.
    if (
      !channels.some((c) => c.name === "line") &&
      isRetryableStatus(row.lineStatus)
    ) {
      linePatch.lineStatus = linePatch.lineStatus ?? "skipped";
    }
    if (
      !channels.some((c) => c.name === "email") &&
      isRetryableStatus(row.emailStatus)
    ) {
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
          claimedAt: null,
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
        sql`${notifications.createdAt} >= ${since}`,
        claimAvailable()
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
