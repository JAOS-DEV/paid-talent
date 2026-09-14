import { and, eq, isNull } from "drizzle-orm";
import { db, type DbClient } from "@/lib/db";
import { adminEntitlements, type AdminEntitlement } from "@/lib/db/schema";
import {
  isAdminGrantActive,
  resolveAdminGrantWindow,
  toAdminGrantSnapshot,
  type AdminGrantRequest,
} from "@/lib/entitlements";

export async function upsertAdminEntitlement(input: {
  userId: string;
  requested: AdminGrantRequest;
  reason: string;
  adminEmail: string;
  now?: Date;
  db?: DbClient;
}): Promise<{
  grant: AdminEntitlement;
  action: "grant" | "extend" | "lifetime";
  previousGrant: AdminEntitlement | null;
}> {
  const now = input.now ?? new Date();
  const client = input.db ?? db;
  const [current] = await client
    .select()
    .from(adminEntitlements)
    .where(
      and(
        eq(adminEntitlements.userId, input.userId),
        eq(adminEntitlements.kind, "top_talent_unlock"),
        isNull(adminEntitlements.revokedAt)
      )
    )
    .limit(1);

  const window = resolveAdminGrantWindow({
    now,
    currentActiveGrant: current ? toAdminGrantSnapshot(current) : null,
    requested: input.requested,
  });

  if (current && isAdminGrantActive(toAdminGrantSnapshot(current), now)) {
    const [updated] = await client
      .update(adminEntitlements)
      .set({
        startsAt: window.startsAt,
        expiresAt: window.expiresAt,
        isLifetime: window.isLifetime,
        reason: input.reason,
        grantedByAdminEmail: input.adminEmail,
      })
      .where(eq(adminEntitlements.id, current.id))
      .returning();

    return {
      grant: updated,
      action: window.action,
      previousGrant: current,
    };
  }

  if (current) {
    await client
      .update(adminEntitlements)
      .set({
        revokedAt: now,
        revokedByAdminEmail: input.adminEmail,
        revocationReason: "replaced_by_new_grant",
      })
      .where(eq(adminEntitlements.id, current.id));
  }

  const [created] = await client
    .insert(adminEntitlements)
    .values({
      userId: input.userId,
      kind: "top_talent_unlock",
      startsAt: window.startsAt,
      expiresAt: window.expiresAt,
      isLifetime: window.isLifetime,
      reason: input.reason,
      grantedByAdminEmail: input.adminEmail,
      createdAt: now,
    })
    .returning();

  return {
    grant: created,
    action: window.action,
    previousGrant: current ?? null,
  };
}

export async function revokeAdminEntitlement(input: {
  userId: string;
  adminEmail: string;
  reason: string;
  now?: Date;
  db?: DbClient;
}): Promise<AdminEntitlement | null> {
  const now = input.now ?? new Date();
  const client = input.db ?? db;
  const [current] = await client
    .select()
    .from(adminEntitlements)
    .where(
      and(
        eq(adminEntitlements.userId, input.userId),
        eq(adminEntitlements.kind, "top_talent_unlock"),
        isNull(adminEntitlements.revokedAt)
      )
    )
    .limit(1);

  if (!current) {
    return null;
  }

  const [updated] = await client
    .update(adminEntitlements)
    .set({
      revokedAt: now,
      revokedByAdminEmail: input.adminEmail,
      revocationReason: input.reason,
    })
    .where(eq(adminEntitlements.id, current.id))
    .returning();

  return updated;
}
