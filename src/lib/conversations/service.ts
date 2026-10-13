import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  sql,
} from "drizzle-orm";
import {
  contactRequests,
  contactShares,
  conversations,
  db,
  messageFlags,
  messages,
  profilePhotos,
  recruiterProfiles,
  users,
  venues,
  workerProfiles,
  type ContactShareChannel,
  type Conversation,
  type Message,
} from "@/lib/db";
import { filterOutgoingText } from "@/lib/messaging/content-filter";
import { getMessagingSettings } from "@/lib/messaging/settings";
import { SAFETY_NOTICE_CATEGORIES } from "@/lib/messaging/risk-keywords";
import { toPublicVenueLogoUrl } from "@/lib/media/venue-logo";
import {
  BLOCKED_CONTACT_MESSAGE,
  isBlockedEitherWay,
} from "@/lib/safety/blocks";
import { conversationError, type ConversationServiceError } from "./errors";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_10_MIN = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 30;

export type ConversationParticipantRole = "worker" | "recruiter";

export interface ConversationListItem {
  id: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unread: boolean;
  counterpart: {
    displayName: string;
    photoUrl: string | null;
    verifiedPro: boolean;
  };
}

export interface MessageDto {
  id: string;
  kind: string;
  body: string;
  isMine: boolean;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  status: string;
  contactRequestId: string;
  counterpart: ConversationListItem["counterpart"] & { userId: string };
  messages: MessageDto[];
  safetyNotice: boolean;
  shareChannels: ContactShareChannel[];
  messageMaxChars: number;
}

function firstName(name: string | null): string {
  if (!name) return "";
  const part = name.trim().split(/\s+/)[0];
  return part || "";
}

function hiddenColumn(role: ConversationParticipantRole) {
  return role === "worker"
    ? isNull(conversations.workerHiddenAt)
    : isNull(conversations.recruiterHiddenAt);
}

function participantWhere(userId: string, role: ConversationParticipantRole) {
  return and(
    role === "worker"
      ? eq(conversations.workerUserId, userId)
      : eq(conversations.recruiterUserId, userId),
    hiddenColumn(role)
  );
}

async function loadShareChannels(
  userId: string,
  role: ConversationParticipantRole
): Promise<ContactShareChannel[]> {
  if (role === "worker") {
    const [row] = await db
      .select({
        lineId: workerProfiles.lineId,
        phoneNumber: workerProfiles.phoneNumber,
        whatsappNumber: workerProfiles.whatsappNumber,
      })
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, userId))
      .limit(1);
    if (!row) return [];
    const channels: ContactShareChannel[] = [];
    if (row.lineId?.trim()) channels.push("line");
    if (row.phoneNumber?.trim()) channels.push("phone");
    if (row.whatsappNumber?.trim()) channels.push("whatsapp");
    return channels;
  }

  const [row] = await db
    .select({
      lineId: recruiterProfiles.lineId,
      contactPhone: recruiterProfiles.contactPhone,
    })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, userId))
    .limit(1);
  if (!row) return [];
  const channels: ContactShareChannel[] = [];
  if (row.lineId?.trim()) channels.push("line");
  if (row.contactPhone?.trim()) channels.push("phone");
  return channels;
}

async function resolveSharerContactValue(
  userId: string,
  role: ConversationParticipantRole,
  channel: ContactShareChannel
): Promise<string | null> {
  if (role === "worker") {
    const [row] = await db
      .select({
        lineId: workerProfiles.lineId,
        phoneNumber: workerProfiles.phoneNumber,
        whatsappNumber: workerProfiles.whatsappNumber,
      })
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, userId))
      .limit(1);
    if (!row) return null;
    if (channel === "line") return row.lineId?.trim() ?? null;
    if (channel === "phone") return row.phoneNumber?.trim() ?? null;
    return row.whatsappNumber?.trim() ?? null;
  }

  const [row] = await db
    .select({
      lineId: recruiterProfiles.lineId,
      contactPhone: recruiterProfiles.contactPhone,
    })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, userId))
    .limit(1);
  if (!row) return null;
  if (channel === "line") return row.lineId?.trim() ?? null;
  if (channel === "phone") return row.contactPhone?.trim() ?? null;
  return null;
}

function shareBodyLabel(channel: ContactShareChannel, value: string): string {
  const labels: Record<ContactShareChannel, string> = {
    line: "LINE",
    phone: "Phone",
    whatsapp: "WhatsApp",
  };
  return `${labels[channel]}: ${value}`;
}

async function computeSafetyNotice(
  conversationId: string,
  contactRequestId: string
): Promise<boolean> {
  const [request] = await db
    .select({ isFlagged: contactRequests.isFlagged })
    .from(contactRequests)
    .where(eq(contactRequests.id, contactRequestId))
    .limit(1);

  if (request?.isFlagged) {
    const [reqFlag] = await db
      .select({ categories: messageFlags.categories })
      .from(messageFlags)
      .where(
        and(
          eq(messageFlags.contactRequestId, contactRequestId),
          eq(messageFlags.targetType, "contact_request")
        )
      )
      .limit(1);
    if (
      reqFlag?.categories.some((c) =>
        SAFETY_NOTICE_CATEGORIES.includes(
          c as (typeof SAFETY_NOTICE_CATEGORIES)[number]
        )
      )
    ) {
      return true;
    }
  }

  const flaggedMessages = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.isFlagged, true)
      )
    );

  if (flaggedMessages.length === 0) return false;

  const messageIds = flaggedMessages.map((m) => m.id);
  const flags = await db
    .select({ categories: messageFlags.categories })
    .from(messageFlags)
    .where(
      and(
        eq(messageFlags.targetType, "message"),
        inArray(messageFlags.messageId, messageIds)
      )
    );

  return flags.some((f) =>
    f.categories.some((c) =>
      SAFETY_NOTICE_CATEGORIES.includes(
        c as (typeof SAFETY_NOTICE_CATEGORIES)[number]
      )
    )
  );
}

export async function listConversations(
  userId: string,
  role: ConversationParticipantRole
): Promise<{ conversations: ConversationListItem[]; unreadCount: number }> {
  const rows = await db
    .select({
      id: conversations.id,
      lastMessageAt: conversations.lastMessageAt,
      workerLastReadAt: conversations.workerLastReadAt,
      recruiterLastReadAt: conversations.recruiterLastReadAt,
      isPro: contactRequests.isPro,
      venueName: venues.name,
      venueLogoUrl: venues.logoUrl,
      workerDisplayName: workerProfiles.displayName,
      workerUserName: users.name,
      workerPhotoUrl: workerProfiles.photoUrl,
      approvedPhotoUrl: profilePhotos.photoUrl,
    })
    .from(conversations)
    .innerJoin(
      contactRequests,
      eq(contactRequests.id, conversations.contactRequestId)
    )
    .leftJoin(venues, eq(venues.id, conversations.venueId))
    .leftJoin(
      workerProfiles,
      eq(workerProfiles.id, conversations.workerProfileId)
    )
    .leftJoin(users, eq(users.id, workerProfiles.userId))
    .leftJoin(
      profilePhotos,
      and(
        eq(profilePhotos.workerProfileId, conversations.workerProfileId),
        eq(profilePhotos.isCurrentApproved, true)
      )
    )
    .where(participantWhere(userId, role))
    .orderBy(
      desc(
        sql`coalesce(${conversations.lastMessageAt}, ${conversations.createdAt})`
      )
    );

  const latestBodies = new Map<string, string>();
  for (const row of rows) {
    const [lastMsg] = await db
      .select({ body: messages.body })
      .from(messages)
      .where(eq(messages.conversationId, row.id))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    latestBodies.set(row.id, lastMsg?.body ?? "");
  }

  let unreadCount = 0;
  const items: ConversationListItem[] = rows.map((row) => {
    const lastRead =
      role === "worker" ? row.workerLastReadAt : row.recruiterLastReadAt;
    const unread =
      row.lastMessageAt != null &&
      (lastRead == null || row.lastMessageAt.getTime() > lastRead.getTime());
    if (unread) unreadCount += 1;

    if (role === "worker") {
      return {
        id: row.id,
        lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
        lastMessagePreview: latestBodies.get(row.id) ?? null,
        unread,
        counterpart: {
          displayName: row.venueName ?? "Venue",
          photoUrl: toPublicVenueLogoUrl(row.venueLogoUrl),
          verifiedPro: row.isPro,
        },
      };
    }

    return {
      id: row.id,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: latestBodies.get(row.id) ?? null,
      unread,
      counterpart: {
        displayName: firstName(row.workerUserName ?? row.workerDisplayName),
        photoUrl: row.approvedPhotoUrl ?? row.workerPhotoUrl,
        verifiedPro: true,
      },
    };
  });

  return { conversations: items, unreadCount };
}

export async function getConversation(
  userId: string,
  conversationId: string,
  role: ConversationParticipantRole,
  options: { before?: Date; limit?: number } = {}
): Promise<
  | { ok: true; conversation: ConversationDetail }
  | ConversationServiceError
> {
  const limit = options.limit ?? 50;

  const [row] = await db
    .select({
      conversation: conversations,
      isPro: contactRequests.isPro,
      contactRequestId: contactRequests.id,
      venueName: venues.name,
      venueLogoUrl: venues.logoUrl,
      workerDisplayName: workerProfiles.displayName,
      workerUserName: users.name,
      workerPhotoUrl: workerProfiles.photoUrl,
      approvedPhotoUrl: profilePhotos.photoUrl,
    })
    .from(conversations)
    .innerJoin(
      contactRequests,
      eq(contactRequests.id, conversations.contactRequestId)
    )
    .leftJoin(venues, eq(venues.id, conversations.venueId))
    .leftJoin(
      workerProfiles,
      eq(workerProfiles.id, conversations.workerProfileId)
    )
    .leftJoin(users, eq(users.id, workerProfiles.userId))
    .leftJoin(
      profilePhotos,
      and(
        eq(profilePhotos.workerProfileId, conversations.workerProfileId),
        eq(profilePhotos.isCurrentApproved, true)
      )
    )
    .where(
      and(
        eq(conversations.id, conversationId),
        role === "worker"
          ? eq(conversations.workerUserId, userId)
          : eq(conversations.recruiterUserId, userId)
      )
    )
    .limit(1);

  if (!row) {
    return conversationError(
      "conversation_not_found",
      404,
      "Conversation not found"
    );
  }

  const now = new Date();
  await db
    .update(conversations)
    .set(
      role === "worker"
        ? { workerLastReadAt: now }
        : { recruiterLastReadAt: now }
    )
    .where(eq(conversations.id, conversationId));

  const conditions = [eq(messages.conversationId, conversationId)];
  if (options.before) {
    conditions.push(lt(messages.createdAt, options.before));
  }

  const messageRows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  messageRows.reverse();

  const safetyNotice =
    role === "worker"
      ? await computeSafetyNotice(conversationId, row.contactRequestId)
      : false;

  const counterpartUserId =
    role === "worker"
      ? row.conversation.recruiterUserId
      : row.conversation.workerUserId;

  const counterpart =
    role === "worker"
      ? {
          userId: counterpartUserId,
          displayName: row.venueName ?? "Venue",
          photoUrl: toPublicVenueLogoUrl(row.venueLogoUrl),
          verifiedPro: row.isPro,
        }
      : {
          userId: counterpartUserId,
          displayName: firstName(row.workerUserName ?? row.workerDisplayName),
          photoUrl: row.approvedPhotoUrl ?? row.workerPhotoUrl,
          verifiedPro: true,
        };

  const shareChannels = await loadShareChannels(userId, role);
  const settings = await getMessagingSettings();

  return {
    ok: true,
    conversation: {
      id: row.conversation.id,
      status: row.conversation.status,
      contactRequestId: row.contactRequestId,
      counterpart,
      safetyNotice,
      shareChannels,
      messageMaxChars: settings.messageMaxChars,
      messages: messageRows.map((msg) => ({
        id: msg.id,
        kind: msg.kind,
        body: msg.body,
        isMine: msg.senderUserId === userId,
        createdAt: msg.createdAt.toISOString(),
      })),
    },
  };
}

async function countRecentMessages(
  conversationId: string,
  userId: string,
  now: Date
): Promise<number> {
  const since = new Date(now.getTime() - MS_PER_10_MIN);
  const [row] = await db
    .select({ value: count() })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.senderUserId, userId),
        gte(messages.createdAt, since)
      )
    );
  return Number(row?.value ?? 0);
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  body: string,
  now: Date = new Date()
): Promise<
  | { ok: true; message: Message; nudge?: "use_share_button" }
  | ConversationServiceError
> {
  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (
    !convo ||
    (convo.workerUserId !== userId && convo.recruiterUserId !== userId)
  ) {
    return conversationError(
      "conversation_not_found",
      404,
      "Conversation not found"
    );
  }

  if (convo.status !== "open") {
    return conversationError(
      "conversation_closed",
      409,
      "This conversation is not open"
    );
  }

  const counterpartId =
    convo.workerUserId === userId
      ? convo.recruiterUserId
      : convo.workerUserId;
  if (await isBlockedEitherWay(userId, counterpartId)) {
    return conversationError(
      "users_blocked",
      403,
      BLOCKED_CONTACT_MESSAGE
    );
  }

  const settings = await getMessagingSettings();
  const filtered = filterOutgoingText(body, {
    maxChars: settings.messageMaxChars,
    context: "chat",
  });

  if (!filtered.ok) {
    if (filtered.code === "empty") {
      return conversationError("message_empty", 422, "Message cannot be empty");
    }
    if (filtered.code === "too_long") {
      return conversationError("message_too_long", 422, "Message is too long");
    }
    return conversationError(
      "contact_info_blocked",
      422,
      "Contact information is not allowed in chat",
      { nudge: "use_share_button" }
    );
  }

  const recent = await countRecentMessages(conversationId, userId, now);
  if (recent >= RATE_LIMIT_MAX) {
    return conversationError(
      "rate_limited",
      429,
      "Too many messages. Please wait a few minutes."
    );
  }

  const flagCategories: string[] = [...filtered.risk.categories];
  const flagTerms: string[] = [...filtered.risk.terms];
  if (filtered.contactTypes?.length) {
    flagCategories.push("contact_shared_in_text");
    flagTerms.push(...filtered.contactTypes);
  }

  const [inserted] = await db
    .insert(messages)
    .values({
      conversationId,
      senderUserId: userId,
      kind: "text",
      body: body.trim(),
      isFlagged: flagCategories.length > 0,
      createdAt: now,
    })
    .returning();

  if (flagCategories.length > 0) {
    await db.insert(messageFlags).values({
      targetType: "message",
      messageId: inserted.id,
      conversationId,
      authorUserId: userId,
      categories: flagCategories,
      matchedTerms: flagTerms,
      createdAt: now,
    });
  }

  await db
    .update(conversations)
    .set({
      lastMessageAt: now,
      lastActivityAt: now,
      retentionExpiresAt: new Date(
        now.getTime() + settings.retentionDays * MS_PER_DAY
      ),
    })
    .where(eq(conversations.id, conversationId));

  return {
    ok: true,
    message: inserted,
    ...(filtered.nudge ? { nudge: filtered.nudge } : {}),
  };
}

export async function shareContact(
  userId: string,
  conversationId: string,
  channel: ContactShareChannel,
  now: Date = new Date()
): Promise<
  | { ok: true; message: Message }
  | ConversationServiceError
> {
  if (!["line", "phone", "whatsapp"].includes(channel)) {
    return conversationError("invalid_channel", 400, "Invalid share channel");
  }

  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (
    !convo ||
    (convo.workerUserId !== userId && convo.recruiterUserId !== userId)
  ) {
    return conversationError(
      "conversation_not_found",
      404,
      "Conversation not found"
    );
  }

  if (convo.status !== "open") {
    return conversationError(
      "conversation_closed",
      409,
      "This conversation is not open"
    );
  }

  const counterpartId =
    convo.workerUserId === userId
      ? convo.recruiterUserId
      : convo.workerUserId;
  if (await isBlockedEitherWay(userId, counterpartId)) {
    return conversationError(
      "users_blocked",
      403,
      BLOCKED_CONTACT_MESSAGE
    );
  }

  const role: ConversationParticipantRole =
    convo.workerUserId === userId ? "worker" : "recruiter";

  const value = await resolveSharerContactValue(userId, role, channel);
  if (!value) {
    return conversationError(
      "no_value",
      400,
      "Add this contact detail in your profile settings first"
    );
  }

  const recipientUserId =
    role === "worker" ? convo.recruiterUserId : convo.workerUserId;

  const settings = await getMessagingSettings();
  const body = shareBodyLabel(channel, value);

  const [inserted] = await db
    .insert(messages)
    .values({
      conversationId,
      senderUserId: userId,
      kind: "contact_share",
      body,
      createdAt: now,
    })
    .returning();

  await db.insert(contactShares).values({
    conversationId,
    messageId: inserted.id,
    sharerUserId: userId,
    recipientUserId,
    channel,
    createdAt: now,
  });

  await db
    .update(conversations)
    .set({
      lastMessageAt: now,
      lastActivityAt: now,
      retentionExpiresAt: new Date(
        now.getTime() + settings.retentionDays * MS_PER_DAY
      ),
    })
    .where(eq(conversations.id, conversationId));

  return { ok: true, message: inserted };
}

export async function hideConversation(
  userId: string,
  conversationId: string,
  now: Date = new Date()
): Promise<{ ok: true; conversation: Conversation } | ConversationServiceError> {
  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (
    !convo ||
    (convo.workerUserId !== userId && convo.recruiterUserId !== userId)
  ) {
    return conversationError(
      "conversation_not_found",
      404,
      "Conversation not found"
    );
  }

  const isWorker = convo.workerUserId === userId;
  const [updated] = await db
    .update(conversations)
    .set(
      isWorker
        ? { workerHiddenAt: now }
        : { recruiterHiddenAt: now }
    )
    .where(eq(conversations.id, conversationId))
    .returning();

  return { ok: true, conversation: updated };
}

export async function seedConversationMessagesFromRequest(
  input: {
    conversationId: string;
    recruiterUserId: string;
    openerText: string;
    openerCreatedAt: Date;
    followUpText?: string | null;
    followUpSentAt?: Date | null;
  },
  client: Pick<typeof db, "insert"> = db
): Promise<void> {
  await client.insert(messages).values({
    conversationId: input.conversationId,
    senderUserId: input.recruiterUserId,
    kind: "text",
    body: input.openerText,
    createdAt: input.openerCreatedAt,
  });

  if (input.followUpText && input.followUpSentAt) {
    await client.insert(messages).values({
      conversationId: input.conversationId,
      senderUserId: input.recruiterUserId,
      kind: "text",
      body: input.followUpText,
      createdAt: input.followUpSentAt,
    });
  }
}

export async function flagContactRequestText(input: {
  contactRequestId: string;
  conversationId?: string | null;
  authorUserId: string;
  text: string;
  now?: Date;
}): Promise<void> {
  const filtered = filterOutgoingText(input.text, {
    maxChars: 5000,
    context: "opener",
  });
  if (!filtered.ok || filtered.risk.categories.length === 0) {
    return;
  }

  const now = input.now ?? new Date();
  await db
    .update(contactRequests)
    .set({ isFlagged: true, updatedAt: now })
    .where(eq(contactRequests.id, input.contactRequestId));

  await db.insert(messageFlags).values({
    targetType: "contact_request",
    contactRequestId: input.contactRequestId,
    conversationId: input.conversationId ?? null,
    authorUserId: input.authorUserId,
    categories: filtered.risk.categories,
    matchedTerms: filtered.risk.terms,
    createdAt: now,
  });
}
