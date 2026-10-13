import { getAdminEmailAllowlist } from "@/lib/admin/allowlist";
import { sendDirectEmail } from "@/lib/notifications/email";

/**
 * Notify admins of a safety event (e.g. auto-pause from reports).
 * Logs always. Emails ADMIN_EMAILS via the email channel when configured
 * (in-app notifications are not created for admins).
 */
export async function notifyAdmins(input: {
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const recipients = getAdminEmailAllowlist();
  console.info("[safety:notifyAdmins]", {
    subject: input.subject,
    body: input.body,
    recipients,
    metadata: input.metadata ?? null,
  });

  for (const to of recipients) {
    const result = await sendDirectEmail({
      to,
      subject: input.subject,
      text: input.body,
    });
    if (!result.ok) {
      console.error("[safety:notifyAdmins] email failed", {
        toHash: to.slice(0, 3),
        error: result.error,
      });
    }
  }
}
