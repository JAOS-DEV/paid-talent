import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lineLinks, userNotificationPrefs } from "@/lib/db/schema";
import {
  getLineMessagingChannelAccessToken,
  isLineMessagingConfigured,
} from "@/lib/line/config";
import {
  getLinePushesSentThisMonth,
  incrementLinePushUsage,
} from "@/lib/line/usage";
import { getMessagingSettings } from "@/lib/messaging/settings";
import type {
  NotificationChannel,
  RenderedNotification,
} from "@/lib/notifications/types";

export type LineFetch = typeof fetch;

function isQuotaOrRateLimitFailure(status: number, bodyText: string): boolean {
  if (status === 429) return true;
  const lower = bodyText.toLowerCase();
  return (
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("monthly limit") ||
    lower.includes("reached the limit")
  );
}

export class LineChannel implements NotificationChannel {
  readonly name = "line" as const;

  constructor(private readonly fetchImpl: LineFetch = fetch) {}

  isConfigured(): boolean {
    return isLineMessagingConfigured();
  }

  async canDeliverTo(
    userId: string
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, reason: "not_configured" };
    }

    const [prefs] = await db
      .select({ lineEnabled: userNotificationPrefs.lineEnabled })
      .from(userNotificationPrefs)
      .where(eq(userNotificationPrefs.userId, userId))
      .limit(1);

    if (prefs && prefs.lineEnabled === false) {
      return { ok: false, reason: "line_disabled" };
    }

    const [link] = await db
      .select({
        lineUserId: lineLinks.lineUserId,
        isFriend: lineLinks.isFriend,
      })
      .from(lineLinks)
      .where(eq(lineLinks.userId, userId))
      .limit(1);

    if (!link) {
      return { ok: false, reason: "not_linked" };
    }
    if (!link.isFriend) {
      return { ok: false, reason: "not_friend" };
    }

    const settings = await getMessagingSettings();
    const sent = await getLinePushesSentThisMonth();
    if (sent >= settings.lineMonthlyPushBudget) {
      return { ok: false, reason: "budget_exhausted" };
    }

    return { ok: true };
  }

  async send(
    userId: string,
    rendered: RenderedNotification
  ): Promise<{ ok: true } | { ok: false; error: string; retryable: boolean }> {
    const token = getLineMessagingChannelAccessToken();
    if (!token) {
      return { ok: false, error: "not_configured", retryable: false };
    }

    const [link] = await db
      .select({ lineUserId: lineLinks.lineUserId })
      .from(lineLinks)
      .where(eq(lineLinks.userId, userId))
      .limit(1);

    if (!link?.lineUserId) {
      return { ok: false, error: "not_linked", retryable: false };
    }

    const text = `${rendered.text}\n${rendered.url}`.slice(0, 5000);
    const retryKey = randomUUID();

    try {
      const response = await this.fetchImpl(
        "https://api.line.me/v2/bot/message/push",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Line-Retry-Key": retryKey,
          },
          body: JSON.stringify({
            to: link.lineUserId,
            messages: [{ type: "text", text }],
          }),
        }
      );

      if (response.ok) {
        await db.transaction(async (tx) => {
          await incrementLinePushUsage(new Date(), tx);
        });
        return { ok: true };
      }

      const bodyText = await response.text().catch(() => "");
      if (
        response.status === 429 ||
        isQuotaOrRateLimitFailure(response.status, bodyText)
      ) {
        return {
          ok: false,
          error: `line_quota_${response.status}`,
          retryable: false,
        };
      }

      if (response.status >= 500) {
        return {
          ok: false,
          error: `line_http_${response.status}`,
          retryable: true,
        };
      }

      return {
        ok: false,
        error: `line_http_${response.status}`,
        retryable: false,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "line_send_failed";
      return { ok: false, error: message, retryable: true };
    }
  }
}

export const lineChannel = new LineChannel();
