import { and, eq, or } from "drizzle-orm";
import { db, type DbClient } from "@/lib/db";
import {
  contactRequests,
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

async function resolveBlockTarget(input: {
  blockerUserId: string;
  conversationId?: string | null;
  contactRequestId?: string | null;
}): Promise<
  | {
      ok: true;
      blockedUserId: string;
      conversationId: string | null;
    }
  | { ok: false; status: number; error: string; code?: string }
> {
  if (input.conversationId) {
    const [convo] = await db
      .select({
        id: conversations.id,
        workerUserId: conversations.workerUserId,
        recruiterUserId: conversations.recruiterUserId,
      })
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .limit(1);

    if (
      !convo ||
      (convo.workerUserId !== input.blockerUserId &&
        convo.recruiterUserId !== input.blockerUserId)
    ) {
      return {
        ok: false,
        status: 404,
        error: "Conversation not found",
        code: "not_found",
      };
    }

    return {
      ok: true,
      blockedUserId:
        convo.workerUserId === input.blockerUserId
          ? convo.recruiterUserId
          : convo.workerUserId,
      conversationId: convo.id,
    };
  }

  if (input.contactRequestId) {
    const [request] = await db
      .select({
        id: contactRequests.id,
        workerUserId: contactRequests.workerUserId,
        recruiterUserId: contactRequests.recruiterUserId,
      })
      .from(contactRequests)
      .where(eq(contactRequests.id, input.contactRequestId))
      .limit(1);

    if (
      !request ||
      (request.workerUserId !== input.blockerUserId &&
        request.recruiterUserId !== input.blockerUserId)
    ) {
      return {
        ok: false,
        status: 404,
        error: "Contact request not found",
        code: "not_found",
      };
    }

    const [linkedConvo] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.contactRequestId, request.id))
      .limit(1);

    return {
      ok: true,
      blockedUserId:
        request.workerUserId === input.blockerUserId
          ? request.recruiterUserId
          : request.workerUserId,
      conversationId: linkedConvo?.id ?? null,
    };
  }

  return {
    ok: false,
    status: 400,
    error: "conversationId or contactRequestId is required",
    code: "missing_target",
  };
}

async function markConversationsBlocked(
  blockerUserId: string,
  blockedUserId: string,
  conversationId: string | null
): Promise<void> {
  if (conversationId) {
    await db
      .update(conversations)
      .set({ status: "blocked" })
      .where(eq(conversations.id, conversationId));
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
  conversationId?: string | null;
  contactRequestId?: string | null;
  now?: Date;
}): Promise<
  | { ok: true; block: UserBlock }
  | { ok: false; status: number; error: string; code?: string }
> {
  const now = input.now ?? new Date();
  const target = await resolveBlockTarget(input);
  if (!target.ok) {
    return target;
  }

  if (input.blockerUserId === target.blockedUserId) {
    return { ok: false, status: 400, error: "You cannot block yourself" };
  }

  const [inserted] = await db
    .insert(userBlocks)
    .values({
      blockerUserId: input.blockerUserId,
      blockedUserId: target.blockedUserId,
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
            eq(userBlocks.blockedUserId, target.blockedUserId)
          )
        )
        .limit(1)
    )[0];

  if (!block) {
    return { ok: false, status: 500, error: "Failed to create block" };
  }

  await markConversationsBlocked(
    input.blockerUserId,
    target.blockedUserId,
    target.conversationId
  );

  return { ok: true, block };
}

export async function unblockUser(input: {
  blockerUserId: string;
  blockId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const deleted = await db
    .delete(userBlocks)
    .where(
      and(
        eq(userBlocks.id, input.blockId),
        eq(userBlocks.blockerUserId, input.blockerUserId)
      )
    )
    .returning({ id: userBlocks.id });

  if (deleted.length === 0) {
    return { ok: false, status: 404, error: "Block not found" };
  }

  return { ok: true };
}

export interface BlockedAccountDto {
  id: string;
  name: string | null;
  blockedAt: string;
}

export async function listBlockedAccounts(
  blockerUserId: string
): Promise<BlockedAccountDto[]> {
  const rows = await db
    .select({
      id: userBlocks.id,
      name: users.name,
      blockedAt: userBlocks.createdAt,
    })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedUserId))
    .where(eq(userBlocks.blockerUserId, blockerUserId));

  return rows.map((row) => ({
    id: row.id,
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
