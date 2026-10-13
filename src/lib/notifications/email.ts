import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userNotificationPrefs, users } from "@/lib/db/schema";
import type {
  NotificationChannel,
  NotificationSendOptions,
  RenderedNotification,
} from "@/lib/notifications/types";

export interface EmailTransport {
  sendMail(input: {
    to: string;
    subject: string;
    text: string;
  }): Promise<void>;
}

class NoopEmailTransport implements EmailTransport {
  async sendMail(input: {
    to: string;
    subject: string;
    text: string;
  }): Promise<void> {
    const hash = createHash("sha256")
      .update(input.to.toLowerCase())
      .digest("hex")
      .slice(0, 8);
    console.info(`[email:noop] type=notification to=${hash}`);
    void input.subject;
    void input.text;
  }
}

export function isEmailTransportConfigured(): boolean {
  return Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);
}

type NodemailerLike = {
  createTransport: (server: string) => {
    sendMail: (mail: {
      from: string;
      to: string;
      subject: string;
      text: string;
    }) => Promise<unknown>;
  };
};

/**
 * Lazy nodemailer transport — never import this module from edge/middleware.
 */
export function createEmailTransport(options?: {
  nodemailer?: NodemailerLike;
}): EmailTransport {
  if (!isEmailTransportConfigured()) {
    return new NoopEmailTransport();
  }

  try {
    const nodemailer =
      options?.nodemailer ??
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("nodemailer") as NodemailerLike);
    const transporter = nodemailer.createTransport(process.env.EMAIL_SERVER!);
    const from = process.env.EMAIL_FROM!;

    return {
      async sendMail(input): Promise<void> {
        await transporter.sendMail({
          from,
          to: input.to,
          subject: input.subject,
          text: input.text,
        });
      },
    };
  } catch {
    return new NoopEmailTransport();
  }
}

export class EmailChannel implements NotificationChannel {
  readonly name = "email" as const;

  constructor(private readonly transport: EmailTransport = createEmailTransport()) {}

  isConfigured(): boolean {
    return isEmailTransportConfigured();
  }

  async canDeliverTo(
    userId: string
  ): Promise<{ ok: boolean; reason?: string }> {
    const [user] = await db
      .select({
        email: users.email,
        accountStatus: users.accountStatus,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { ok: false, reason: "user_not_found" };
    }
    if (user.accountStatus !== "active") {
      return { ok: false, reason: "account_inactive" };
    }
    if (!user.email?.trim()) {
      return { ok: false, reason: "no_email" };
    }

    const [prefs] = await db
      .select({ emailEnabled: userNotificationPrefs.emailEnabled })
      .from(userNotificationPrefs)
      .where(eq(userNotificationPrefs.userId, userId))
      .limit(1);

    // Missing prefs row → default email on
    if (prefs && prefs.emailEnabled === false) {
      return { ok: false, reason: "email_disabled" };
    }

    return { ok: true };
  }

  async send(
    userId: string,
    rendered: RenderedNotification,
    _options?: NotificationSendOptions
  ): Promise<{ ok: true } | { ok: false; error: string; retryable: boolean }> {
    void _options;
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.email?.trim()) {
      return { ok: false, error: "no_email", retryable: false };
    }

    try {
      const body = `${rendered.text}\n\n${rendered.url}`;
      await this.transport.sendMail({
        to: user.email,
        subject: rendered.subject,
        text: body,
      });
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "email_send_failed";
      return { ok: false, error: message, retryable: true };
    }
  }
}

export const emailChannel = new EmailChannel();

/** Send a one-off email (e.g. admin alerts) without an in-app notification row. */
export async function sendDirectEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const transport = createEmailTransport();
    await transport.sendMail(input);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "email_send_failed",
    };
  }
}
