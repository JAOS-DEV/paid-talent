import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recruiterProfiles } from "@/lib/db/schema";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { trimAdminReason } from "@/lib/admin/account-moderation";
import { notify } from "@/lib/notifications";

export async function setRecruiterMessagingPaused(input: {
  recruiterUserId: string;
  paused: boolean;
  reason: string;
  actorUserId: string;
  actorEmail: string;
  now?: Date;
}): Promise<
  | { ok: true; isPaused: boolean }
  | { ok: false; status: number; error: string }
> {
  const reason = trimAdminReason(input.reason);
  if (!reason) {
    return {
      ok: false,
      status: 400,
      error: "A reason of at least 3 characters is required.",
    };
  }

  const now = input.now ?? new Date();
  const [profile] = await db
    .select({
      id: recruiterProfiles.id,
      messagingPausedAt: recruiterProfiles.messagingPausedAt,
    })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, input.recruiterUserId))
    .limit(1);

  if (!profile) {
    return { ok: false, status: 404, error: "Recruiter profile not found." };
  }

  if (input.paused) {
    await db
      .update(recruiterProfiles)
      .set({
        messagingPausedAt: now,
        messagingPausedReason: reason,
        messagingPausedBy: input.actorEmail,
        updatedAt: now,
      })
      .where(eq(recruiterProfiles.id, profile.id));

    await recordAdminAuditEvent({
      action: "recruiter_messaging_paused",
      actorAdminEmail: input.actorEmail,
      actorUserId: input.actorUserId,
      targetUserId: input.recruiterUserId,
      targetType: "recruiter",
      targetId: profile.id,
      reason,
      metadata: { before: profile.messagingPausedAt != null, after: true },
      createdAt: now,
    });

    await notify(input.recruiterUserId, "messaging_paused", {
      recruiterProfileId: profile.id,
    });

    return { ok: true, isPaused: true };
  }

  await db
    .update(recruiterProfiles)
    .set({
      messagingPausedAt: null,
      messagingPausedReason: null,
      messagingPausedBy: null,
      updatedAt: now,
    })
    .where(eq(recruiterProfiles.id, profile.id));

  await recordAdminAuditEvent({
    action: "recruiter_messaging_unpaused",
    actorAdminEmail: input.actorEmail,
    actorUserId: input.actorUserId,
    targetUserId: input.recruiterUserId,
    targetType: "recruiter",
    targetId: profile.id,
    reason,
    metadata: { before: profile.messagingPausedAt != null, after: false },
    createdAt: now,
  });

  return { ok: true, isPaused: false };
}
