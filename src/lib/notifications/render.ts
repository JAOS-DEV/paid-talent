import type { NotificationType } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { isValidLocale } from "@/lib/i18n/config";
import type { RenderedNotification } from "@/lib/notifications/types";
import en from "../../../messages/en.json";
import th from "../../../messages/th.json";

type NotificationMessages = {
  subject: string;
  text: string;
};

type NotificationsRoot = {
  notifications: Record<string, NotificationMessages | string | Record<string, string>>;
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

export function renderNotification(
  type: NotificationType,
  payload: Record<string, string>,
  locale: string,
  options?: { role?: "worker" | "recruiter" }
): RenderedNotification {
  const resolvedLocale: Locale = isValidLocale(locale) ? locale : "en";
  const entry = catalogs[resolvedLocale].notifications[type];
  const fallback = catalogs.en.notifications[type];
  const raw = entry ?? fallback;
  const messages =
    raw &&
    typeof raw === "object" &&
    "subject" in raw &&
    "text" in raw &&
    typeof raw.subject === "string" &&
    typeof raw.text === "string"
      ? (raw as NotificationMessages)
      : null;

  if (!messages) {
    return {
      subject: "Paid Talent",
      text: "You have a new notification.",
      url: `${getAppBaseUrl()}/settings/notifications`,
    };
  }

  const subject = interpolate(messages.subject, payload).trim();
  const text = interpolate(messages.text, payload).trim();
  const url = `${getAppBaseUrl()}${pathForType(type, payload, options?.role)}`;

  return { subject, text, url };
}
