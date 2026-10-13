import { emailChannel } from "@/lib/notifications/email";
import { lineChannel } from "@/lib/notifications/line";
import type { NotificationChannel } from "@/lib/notifications/types";

/**
 * Delivery channel order. Prefer LINE when configured, then email;
 * stop at first success (see deliver()).
 */
export function getNotificationChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  if (lineChannel.isConfigured()) {
    channels.push(lineChannel);
  }
  channels.push(emailChannel);
  return channels;
}
