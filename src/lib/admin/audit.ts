import { db, type DbClient } from "@/lib/db";
import {
  adminAuditEvents,
  type AdminAuditAction,
  type NewAdminAuditEvent,
} from "@/lib/db/schema";

export async function recordAdminAuditEvent(
  input: Omit<NewAdminAuditEvent, "id" | "createdAt"> & {
    createdAt?: Date;
    db?: DbClient;
  }
): Promise<void> {
  const client = input.db ?? db;
  await client.insert(adminAuditEvents).values({
    action: input.action,
    actorAdminEmail: input.actorAdminEmail,
    actorUserId: input.actorUserId ?? null,
    targetUserId: input.targetUserId ?? null,
    targetIdentity: input.targetIdentity ?? null,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? null,
    createdAt: input.createdAt ?? new Date(),
  });
}

export function verificationActionToAudit(
  action: "approve" | "reject" | "revoke"
): AdminAuditAction {
  if (action === "approve") {
    return "identity_verification_approved";
  }
  if (action === "revoke") {
    return "identity_verification_revoked";
  }
  return "identity_verification_rejected";
}
