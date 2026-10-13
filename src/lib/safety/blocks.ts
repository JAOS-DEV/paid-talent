import { and, eq, or } from "drizzle-orm";
import { db, type DbClient } from "@/lib/db";
import {
  conversations,
  userBlocks,
  users,
  type UserBlock,
} from "@/lib/db/schema";

export const BLOCKED_CONTACT_MESSAGE = "You can't contact this person";

export async function isBlockedEitherWay(
  userAId: string,
  userBId: string,
  client: Pick<typeof db, "select"> = db
): Promise<boolean> {
  if (userAId === userBId) {
    return false;
  }

  const [row] = await client
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      or(
        and(
          eq(userBlocks.blockerUserId, userAId),
          eq(userBlocks.blockedUserId, userBId)
        ),
        and(
          eq(userBlocks.blockerUserId, userBId),
          eq(userBlocks.blockedUserId, userAId)
        )
      )
    )
    .limit(1);

  return Boolean(row);
}

async function markConversationsBlocked(
  blockerUserId: string,
  blockedUserId: string,
  conversationId: string | null | undefined
): Promise<void> {
  if (conversationId) {
    const [convo] = await db
      .select({
        id: conversations.id,
        workerUserId: conversations.workerUserId,
        recruiterUserId: conversations.recruiterUserId,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    const isParticipant =
      convo &&
      (convo.workerUserId === blockerUserId ||
        convo.recruiterUserId === blockerUserId) &&
      (convo.workerUserId === blockedUserId ||
        convo.recruiterUserId === blockedUserId);

    if (isParticipant) {
      await db
        .update(conversations)
        .set({ status: "blocked" })
        .where(eq(conversations.id, conversationId));
    }
    return;
  }

  await db
    .update(conversations)
    .set({ status: "blocked" })
    .where(
      and(
        or(
          and(
            eq(conversations.workerUserId, blockerUserId),
            eq(conversations.recruiterUserId, blockedUserId)
          ),
          and(
            eq(conversations.workerUserId, blockedUserId),
            eq(conversations.recruiterUserId, blockerUserId)
          )
        ),
        eq(conversations.status, "open")
      )
    );
}

export async function blockUser(input: {
  blockerUserId: string;
  blockedUserId: string;
  conversationId?: string | null;
  now?: Date;
}): Promise<
  | { ok: true; block: UserBlock }
  | { ok: false; status: number; error: string; code?: string }
> {
  const now = input.now ?? new Date();

  if (input.blockerUserId === input.blockedUserId) {
    return { ok: false, status: 400, error: "You cannot block yourself" };
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, input.blockedUserId))
    .limit(1);

  if (!target) {
    return { ok: false, status: 404, error: "User not found" };
  }

  const [inserted] = await db
    .insert(userBlocks)
    .values({
      blockerUserId: input.blockerUserId,
      blockedUserId: input.blockedUserId,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning();

  const block =
    inserted ??
    (
      await db
        .select()
        .from(userBlocks)
        .where(
          and(
            eq(userBlocks.blockerUserId, input.blockerUserId),
            eq(userBlocks.blockedUserId, input.blockedUserId)
          )
        )
        .limit(1)
    )[0];

  if (!block) {
    return { ok: false, status: 500, error: "Failed to create block" };
  }

  await markConversationsBlocked(
    input.blockerUserId,
    input.blockedUserId,
    input.conversationId
  );

  return { ok: true, block };
}

export async function unblockUser(input: {
  blockerUserId: string;
  blockedUserId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const deleted = await db
    .delete(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerUserId, input.blockerUserId),
        eq(userBlocks.blockedUserId, input.blockedUserId)
      )
    )
    .returning({ id: userBlocks.id });

  if (deleted.length === 0) {
    return { ok: false, status: 404, error: "Block not found" };
  }

  return { ok: true };
}

export interface BlockedAccountDto {
  userId: string;
  name: string | null;
  blockedAt: string;
}

export async function listBlockedAccounts(
  blockerUserId: string
): Promise<BlockedAccountDto[]> {
  const rows = await db
    .select({
      userId: userBlocks.blockedUserId,
      name: users.name,
      blockedAt: userBlocks.createdAt,
    })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedUserId))
    .where(eq(userBlocks.blockerUserId, blockerUserId));

  return rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    blockedAt: row.blockedAt.toISOString(),
  }));
}

export async function countBlocksInvolvingUser(
  userId: string,
  client: DbClient = db
): Promise<number> {
  const rows = await client
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      or(
        eq(userBlocks.blockerUserId, userId),
        eq(userBlocks.blockedUserId, userId)
      )
    );
  return rows.length;
}
