import { emailChannel } from "@/lib/notifications/email";
import type { NotificationChannel } from "@/lib/notifications/types";

/**
 * Delivery channel order. LINE is added in a follow-up PR.
 * Prefer LINE when present, then email; stop at first success.
 */
export function getNotificationChannels(): NotificationChannel[] {
  return [emailChannel];
}
