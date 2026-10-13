import { getAdminEmailAllowlist } from "@/lib/admin/allowlist";

/**
 * Notify admins of a safety event (e.g. auto-pause from reports).
 * Logs always. Email delivery is left for the notifications PR.
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

  // TODO(notifications): email ADMIN_EMAILS when a transactional email helper exists.
  void recipients;
}
