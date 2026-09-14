import { eq } from "drizzle-orm";
import { db, type DbClient } from "@/lib/db";
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
 * The already-issued JWT itself is not forcibly invalidated at Edge, but
 * DB-backed Node/server actions and APIs deny suspended/banned accounts
 * immediately. Paid Talent keeps Edge middleware DB-free. This module
 * unpublishes public worker/recruiter content and records account status.
 * Immediate Edge session revocation would require a dedicated token-version
 * or denylist architecture.
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

async function unpublishRestrictedContent(
  client: DbClient,
  userId: string,
  now: Date
): Promise<void> {
  await client
    .update(workerProfiles)
    .set({ isPublished: false, updatedAt: now })
    .where(eq(workerProfiles.userId, userId));

  const [recruiterProfile] = await client
    .select({ id: recruiterProfiles.id })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, userId))
    .limit(1);

  if (recruiterProfile) {
    await client
      .update(recruiterOpenings)
      .set({ isPublished: false, updatedAt: now })
      .where(eq(recruiterOpenings.recruiterProfileId, recruiterProfile.id));
  }
}

export async function moderateAccountWithClient(
  client: DbClient,
  input: {
    action: AccountModerationAction;
    targetUserId: string;
    reason: string;
    actorUserId: string;
    actorEmail: string;
    now?: Date;
  }
): Promise<
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

  const [target] = await client
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
      db: client,
    });
    await unpublishRestrictedContent(client, target.id, now);
  }

  if (input.action === "suspend") {
    await unpublishRestrictedContent(client, target.id, now);
  }

  if (input.action === "lift_ban" && normalizedEmail) {
    await liftBannedIdentity({
      email: normalizedEmail,
      adminEmail: input.actorEmail,
      now,
      db: client,
    });
  }

  await client
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
    db: client,
  });

  return { ok: true, accountStatus: nextStatus };
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
  return db.transaction(async (tx) =>
    moderateAccountWithClient(tx as DbClient, input)
  );
}

export async function hasActiveDurableBan(
  email: string | null | undefined
): Promise<boolean> {
  const row = await findActiveBannedIdentity(email);
  return row !== null;
}

export { findActiveBannedIdentity };
