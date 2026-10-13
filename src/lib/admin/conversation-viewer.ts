import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contactRequests,
  contactShares,
  conversations,
  messageFlags,
  messages,
  reports,
  users,
  venues,
} from "@/lib/db/schema";
import { recordAdminAuditEvent } from "@/lib/admin/audit";

export async function assertConversationViewable(
  conversationId: string
): Promise<
  | {
      ok: true;
      reportIds: string[];
      flagIds: string[];
      conversation: typeof conversations.$inferSelect;
    }
  | { ok: false; status: 403 | 404; reason: string; error: string }
> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conversation) {
    return {
      ok: false,
      status: 404,
      reason: "not_found",
      error: "Conversation not found",
    };
  }

  const convoReports = await db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.conversationId, conversationId));

  const convoFlags = await db
    .select({ id: messageFlags.id })
    .from(messageFlags)
    .where(eq(messageFlags.conversationId, conversationId));

  const participantOpenReports = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        inArray(reports.status, ["open", "reviewing"]),
        or(
          eq(reports.reportedUserId, conversation.workerUserId),
          eq(reports.reportedUserId, conversation.recruiterUserId),
          eq(reports.reporterUserId, conversation.workerUserId),
          eq(reports.reporterUserId, conversation.recruiterUserId)
        )
      )
    );

  const participantOpenFlags = await db
    .select({ id: messageFlags.id })
    .from(messageFlags)
    .where(
      and(
        eq(messageFlags.status, "open"),
        or(
          eq(messageFlags.authorUserId, conversation.workerUserId),
          eq(messageFlags.authorUserId, conversation.recruiterUserId)
        )
      )
    );

  const reportIds = [
    ...new Set([
      ...convoReports.map((r) => r.id),
      ...participantOpenReports.map((r) => r.id),
    ]),
  ];
  const flagIds = [
    ...new Set([
      ...convoFlags.map((f) => f.id),
      ...participantOpenFlags.map((f) => f.id),
    ]),
  ];

  if (reportIds.length === 0 && flagIds.length === 0) {
    return {
      ok: false,
      status: 403,
      reason: "not_reported_or_flagged",
      error: "Conversation is not linked to a report or flag",
    };
  }

  return { ok: true, reportIds, flagIds, conversation };
}

export async function getAdminConversationView(input: {
  conversationId: string;
  reason: string;
  actorUserId: string;
  actorEmail: string;
  now?: Date;
}): Promise<
  | {
      ok: true;
      data: {
        conversation: {
          id: string;
          status: string;
          createdAt: string;
          legalHoldUntil: string | null;
        };
        request: {
          id: string;
          openerText: string;
          followUpText: string | null;
          status: string;
          createdAt: string;
          venueName: string | null;
        } | null;
        messages: Array<{
          id: string;
          senderUserId: string | null;
          senderRole: "worker" | "recruiter" | "system" | "unknown";
          kind: string;
          body: string;
          createdAt: string;
        }>;
        shares: Array<{
          id: string;
          channel: string;
          sharerUserId: string;
          recipientUserId: string;
          createdAt: string;
        }>;
        participants: {
          worker: { userId: string; name: string | null };
          recruiter: { userId: string; name: string | null };
        };
      };
    }
  | { ok: false; status: number; error: string; reason?: string }
> {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    return {
      ok: false,
      status: 400,
      error: "A view reason of at least 5 characters is required.",
      reason: "reason_required",
    };
  }

  const gate = await assertConversationViewable(input.conversationId);
  if (!gate.ok) {
    return {
      ok: false,
      status: gate.status,
      error: gate.error,
      reason: gate.reason,
    };
  }

  const now = input.now ?? new Date();

  // Audit BEFORE returning data
  await recordAdminAuditEvent({
    action: "conversation_viewed",
    actorAdminEmail: input.actorEmail,
    actorUserId: input.actorUserId,
    targetType: "conversation",
    targetId: input.conversationId,
    reason,
    metadata: {
      reportIds: gate.reportIds,
      flagIds: gate.flagIds,
    },
    createdAt: now,
  });

  const convo = gate.conversation;

  const [requestRow] = await db
    .select({
      id: contactRequests.id,
      openerText: contactRequests.openerText,
      followUpText: contactRequests.followUpText,
      status: contactRequests.status,
      createdAt: contactRequests.createdAt,
      venueName: venues.name,
    })
    .from(contactRequests)
    .leftJoin(venues, eq(venues.id, contactRequests.venueId))
    .where(eq(contactRequests.id, convo.contactRequestId))
    .limit(1);

  const messageRows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convo.id))
    .orderBy(asc(messages.createdAt));

  const shareRows = await db
    .select({
      id: contactShares.id,
      channel: contactShares.channel,
      sharerUserId: contactShares.sharerUserId,
      recipientUserId: contactShares.recipientUserId,
      createdAt: contactShares.createdAt,
    })
    .from(contactShares)
    .where(eq(contactShares.conversationId, convo.id));

  const [workerUser] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, convo.workerUserId))
    .limit(1);
  const [recruiterUser] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, convo.recruiterUserId))
    .limit(1);

  return {
    ok: true,
    data: {
      conversation: {
        id: convo.id,
        status: convo.status,
        createdAt: convo.createdAt.toISOString(),
        legalHoldUntil: convo.legalHoldUntil?.toISOString() ?? null,
      },
      request: requestRow
        ? {
            id: requestRow.id,
            openerText: requestRow.openerText,
            followUpText: requestRow.followUpText,
            status: requestRow.status,
            createdAt: requestRow.createdAt.toISOString(),
            venueName: requestRow.venueName ?? null,
          }
        : null,
      messages: messageRows.map((msg) => {
        let senderRole: "worker" | "recruiter" | "system" | "unknown" =
          "unknown";
        if (!msg.senderUserId) senderRole = "system";
        else if (msg.senderUserId === convo.workerUserId) senderRole = "worker";
        else if (msg.senderUserId === convo.recruiterUserId)
          senderRole = "recruiter";
        return {
          id: msg.id,
          senderUserId: msg.senderUserId,
          senderRole,
          kind: msg.kind,
          body: msg.body,
          createdAt: msg.createdAt.toISOString(),
        };
      }),
      shares: shareRows.map((s) => ({
        id: s.id,
        channel: s.channel,
        sharerUserId: s.sharerUserId,
        recipientUserId: s.recipientUserId,
        createdAt: s.createdAt.toISOString(),
      })),
      participants: {
        worker: {
          userId: convo.workerUserId,
          name: workerUser?.name ?? null,
        },
        recruiter: {
          userId: convo.recruiterUserId,
          name: recruiterUser?.name ?? null,
        },
      },
    },
  };
}
