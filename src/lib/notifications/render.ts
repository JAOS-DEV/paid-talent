import type { NotificationType } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { isValidLocale } from "@/lib/i18n/config";
import type {
  NotificationChannelName,
  RenderedNotification,
} from "@/lib/notifications/types";
import en from "../../../messages/en.json";
import th from "../../../messages/th.json";

type NotificationMessages = {
  subject: string;
  text: string;
};

type NotificationsRoot = {
  notifications: Record<
    string,
    NotificationMessages | string | Record<string, string | NotificationMessages>
  >;
};

const catalogs: Record<Locale, NotificationsRoot> = {
  en: en as unknown as NotificationsRoot,
  th: th as unknown as NotificationsRoot,
};

export function getAppBaseUrl(): string {
  const raw =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

function interpolate(
  template: string,
  payload: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    return payload[key] ?? "";
  });
}

function pathForType(
  type: NotificationType,
  payload: Record<string, string>,
  role?: "worker" | "recruiter"
): string {
  switch (type) {
    case "contact_request_received":
      return "/worker/requests";
    case "contact_request_accepted":
    case "contact_request_declined":
      return "/recruiter/requests";
    case "new_message":
    case "contact_shared": {
      const conversationId = payload.conversationId;
      const base =
        role === "recruiter" ? "/recruiter/messages" : "/worker/messages";
      return conversationId ? `${base}/${conversationId}` : base;
    }
    case "verification_approved":
    case "verification_rejected":
      return role === "recruiter"
        ? "/recruiter/verification"
        : "/worker/verification";
    case "venue_approved":
    case "venue_rejected":
      return "/recruiter/venues";
    case "messaging_paused":
    case "safety_notice":
      return "/settings/notifications";
    default:
      return "/settings/notifications";
  }
}

function asMessages(raw: unknown): NotificationMessages | null {
  if (
    raw &&
    typeof raw === "object" &&
    "subject" in raw &&
    "text" in raw &&
    typeof (raw as NotificationMessages).subject === "string" &&
    typeof (raw as NotificationMessages).text === "string"
  ) {
    return raw as NotificationMessages;
  }
  return null;
}

function resolveMessages(
  type: NotificationType,
  locale: Locale,
  channel: NotificationChannelName
): NotificationMessages | null {
  const root = catalogs[locale].notifications;
  const enRoot = catalogs.en.notifications;

  if (channel === "line") {
    const lineBucket = root.line;
    const enLineBucket = enRoot.line;
    if (lineBucket && typeof lineBucket === "object") {
      const fromLocale = asMessages(
        (lineBucket as Record<string, unknown>)[type]
      );
      if (fromLocale) return fromLocale;
    }
    if (enLineBucket && typeof enLineBucket === "object") {
      const fromEn = asMessages(
        (enLineBucket as Record<string, unknown>)[type]
      );
      if (fromEn) return fromEn;
    }
  }

  return (
    asMessages(root[type]) ?? asMessages(enRoot[type])
  );
}

export function renderNotification(
  type: NotificationType,
  payload: Record<string, string>,
  locale: string,
  options?: {
    role?: "worker" | "recruiter";
    channel?: NotificationChannelName;
  }
): RenderedNotification {
  const resolvedLocale: Locale = isValidLocale(locale) ? locale : "en";
  const channel = options?.channel ?? "email";
  const messages = resolveMessages(type, resolvedLocale, channel);

  const url = `${getAppBaseUrl()}${pathForType(type, payload, options?.role)}`;

  if (!messages) {
    return {
      subject: "Paid Talent",
      text: "You have a new notification.",
      url: `${getAppBaseUrl()}/settings/notifications`,
    };
  }

  // LINE copy is generic: do not interpolate venue/personal names into text.
  const interpolatePayload =
    channel === "line" ? { url } : { ...payload, url };

  const subject = interpolate(messages.subject, interpolatePayload).trim();
  const text = interpolate(messages.text, interpolatePayload).trim();

  return { subject, text, url };
}
