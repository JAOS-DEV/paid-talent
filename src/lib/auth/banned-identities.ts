import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { bannedIdentities } from "@/lib/db/schema";
import { normalizeVerifiedEmail } from "@/lib/auth/identity";

export async function findActiveBannedIdentity(
  email: string | null | undefined
): Promise<{
  id: string;
  normalizedEmail: string;
  originalUserId: string | null;
  reason: string;
  bannedAt: Date;
  bannedByAdminEmail: string;
} | null> {
  const normalizedEmail = normalizeVerifiedEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const [row] = await db
    .select({
      id: bannedIdentities.id,
      normalizedEmail: bannedIdentities.normalizedEmail,
      originalUserId: bannedIdentities.originalUserId,
      reason: bannedIdentities.reason,
      bannedAt: bannedIdentities.bannedAt,
      bannedByAdminEmail: bannedIdentities.bannedByAdminEmail,
    })
    .from(bannedIdentities)
    .where(
      and(
        eq(bannedIdentities.normalizedEmail, normalizedEmail),
        isNull(bannedIdentities.liftedAt)
      )
    )
    .limit(1);

  return row ?? null;
}

export async function recordBannedIdentity(input: {
  email: string;
  originalUserId: string | null;
  reason: string;
  adminEmail: string;
  now?: Date;
}): Promise<void> {
  const normalizedEmail = normalizeVerifiedEmail(input.email);
  if (!normalizedEmail) {
    throw new Error("Cannot ban an identity without a verified email");
  }

  const existing = await findActiveBannedIdentity(normalizedEmail);
  if (existing) {
    return;
  }

  const now = input.now ?? new Date();
  await db.insert(bannedIdentities).values({
    normalizedEmail,
    originalUserId: input.originalUserId,
    reason: input.reason,
    bannedAt: now,
    bannedByAdminEmail: input.adminEmail,
  });
}

export async function liftBannedIdentity(input: {
  email: string;
  adminEmail: string;
  now?: Date;
}): Promise<boolean> {
  const normalizedEmail = normalizeVerifiedEmail(input.email);
  if (!normalizedEmail) {
    return false;
  }

  const existing = await findActiveBannedIdentity(normalizedEmail);
  if (!existing) {
    return false;
  }

  const now = input.now ?? new Date();
  await db
    .update(bannedIdentities)
    .set({
      liftedAt: now,
      liftedByAdminEmail: input.adminEmail,
    })
    .where(eq(bannedIdentities.id, existing.id));

  return true;
}
