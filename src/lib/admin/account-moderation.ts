import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  recruiterOpenings,
  recruiterProfiles,
  users,
  workerProfiles,
  type AccountStatus,
} from "@/lib/db/schema";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { emailsMatch, normalizeVerifiedEmail } from "@/lib/auth/identity";
import {
  findActiveBannedIdentity,
  liftBannedIdentity,
  recordBannedIdentity,
} from "@/lib/auth/banned-identities";
import type { AdminAuditAction } from "@/lib/db/schema";

/**
 * Already-issued JWT sessions are not immediately revoked.
 * Paid Talent keeps Edge middleware DB-free, so a suspended/banned user who
 * already holds a valid JWT may continue until that token expires.
 * This module blocks future authentication and immediately unpublishes
 * public worker/recruiter content. Server/API routes also check account
 * status. Immediate session revocation would require a dedicated
 * token-version or denylist architecture.
 */

const MIN_REASON_LENGTH = 3;

export function trimAdminReason(reason: string | null | undefined): string | null {
  if (!reason) {
    return null;
  }
  const trimmed = reason.trim();
  if (trimmed.length < MIN_REASON_LENGTH) {
    return null;
  }
  return trimmed;
}

export function isSelfModerationTarget(input: {
  actorUserId: string;
  actorEmail: string;
  targetUserId: string;
  targetEmail: string;
}): boolean {
  return (
    input.actorUserId === input.targetUserId ||
    emailsMatch(input.actorEmail, input.targetEmail)
  );
}

export type AccountModerationAction =
  | "suspend"
  | "reactivate"
  | "ban"
  | "lift_ban";

function nextStatusForAction(
  action: AccountModerationAction
): AccountStatus {
  if (action === "suspend") {
    return "suspended";
  }
  if (action === "ban") {
    return "banned";
  }
  return "active";
}

function auditActionFor(action: AccountModerationAction): AdminAuditAction {
  if (action === "suspend") {
    return "account_suspended";
  }
  if (action === "reactivate") {
    return "account_reactivated";
  }
  if (action === "ban") {
    return "account_banned";
  }
  return "ban_lifted";
}

async function unpublishRestrictedContent(userId: string): Promise<void> {
  const now = new Date();
  await db
    .update(workerProfiles)
    .set({ isPublished: false, updatedAt: now })
    .where(eq(workerProfiles.userId, userId));

  const [recruiterProfile] = await db
    .select({ id: recruiterProfiles.id })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, userId))
    .limit(1);

  if (recruiterProfile) {
    await db
      .update(recruiterOpenings)
      .set({ isPublished: false, updatedAt: now })
      .where(eq(recruiterOpenings.recruiterProfileId, recruiterProfile.id));
  }
}

export async function moderateAccount(input: {
  action: AccountModerationAction;
  targetUserId: string;
  reason: string;
  actorUserId: string;
  actorEmail: string;
  now?: Date;
}): Promise<
  | { ok: true; accountStatus: AccountStatus }
  | { ok: false; status: number; error: string }
> {
  const reason = trimAdminReason(input.reason);
  if (
    (input.action === "suspend" || input.action === "ban") &&
    !reason
  ) {
    return {
      ok: false,
      status: 400,
      error: "A reason is required for this action.",
    };
  }
  if (
    (input.action === "reactivate" || input.action === "lift_ban") &&
    !reason
  ) {
    return {
      ok: false,
      status: 400,
      error: "A reason is required for this action.",
    };
  }

  const [target] = await db
    .select({
      id: users.id,
      email: users.email,
      accountStatus: users.accountStatus,
    })
    .from(users)
    .where(eq(users.id, input.targetUserId))
    .limit(1);

  if (!target) {
    return { ok: false, status: 404, error: "User not found." };
  }

  if (
    isSelfModerationTarget({
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      targetUserId: target.id,
      targetEmail: target.email,
    })
  ) {
    return {
      ok: false,
      status: 400,
      error: "You cannot suspend or ban your own currently authenticated account.",
    };
  }

  const now = input.now ?? new Date();
  const nextStatus = nextStatusForAction(input.action);
  const previousStatus = target.accountStatus;
  const normalizedEmail = normalizeVerifiedEmail(target.email);

  if (input.action === "ban") {
    await recordBannedIdentity({
      email: target.email,
      originalUserId: target.id,
      reason: reason!,
      adminEmail: input.actorEmail,
      now,
    });
    await unpublishRestrictedContent(target.id);
  }

  if (input.action === "suspend") {
    await unpublishRestrictedContent(target.id);
  }

  if (input.action === "lift_ban" && normalizedEmail) {
    await liftBannedIdentity({
      email: normalizedEmail,
      adminEmail: input.actorEmail,
      now,
    });
  }

  await db
    .update(users)
    .set({
      accountStatus: nextStatus,
      accountStatusReason: reason,
      accountStatusChangedAt: now,
      accountStatusChangedBy: input.actorEmail,
      updatedAt: now,
    })
    .where(eq(users.id, target.id));

  await recordAdminAuditEvent({
    action: auditActionFor(input.action),
    actorAdminEmail: input.actorEmail,
    actorUserId: input.actorUserId,
    targetUserId: target.id,
    targetIdentity: normalizedEmail,
    targetType: "user",
    targetId: target.id,
    reason,
    metadata: {
      before: previousStatus,
      after: nextStatus,
    },
    createdAt: now,
  });

  return { ok: true, accountStatus: nextStatus };
}

export async function hasActiveDurableBan(
  email: string | null | undefined
): Promise<boolean> {
  const row = await findActiveBannedIdentity(email);
  return row !== null;
}

export { findActiveBannedIdentity };
