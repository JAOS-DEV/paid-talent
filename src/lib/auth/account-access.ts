import { eq } from "drizzle-orm";
import { db, type DbClient } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { findActiveBannedIdentity } from "@/lib/auth/banned-identities";
import {
  resolveAccountRestriction,
  type AccountRestrictionReason,
} from "@/lib/auth/account-restriction";

export async function getUserAccountAccess(
  userId: string,
  client: DbClient = db
): Promise<{
  allowed: boolean;
  reason: AccountRestrictionReason | null;
  email: string | null;
}> {
  const [user] = await client
    .select({
      id: users.id,
      email: users.email,
      accountStatus: users.accountStatus,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { allowed: false, reason: "banned", email: null };
  }

  const activeBan = await findActiveBannedIdentity(user.email, client);
  const reason = resolveAccountRestriction({
    hasActiveBan: Boolean(activeBan),
    accountStatus: user.accountStatus,
  });

  return {
    allowed: reason === null,
    reason,
    email: user.email,
  };
}
