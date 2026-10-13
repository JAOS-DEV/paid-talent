export type NotificationChannelName = "email" | "line";

export interface RenderedNotification {
  subject: string;
  text: string;
  url: string;
}

export interface NotificationChannel {
  name: NotificationChannelName;
  isConfigured(): boolean;
  canDeliverTo(
    userId: string
  ): Promise<{ ok: boolean; reason?: string }>;
  send(
    userId: string,
    rendered: RenderedNotification
  ): Promise<
    { ok: true } | { ok: false; error: string; retryable: boolean }
  >;
}
