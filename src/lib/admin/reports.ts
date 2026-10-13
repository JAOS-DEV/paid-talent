import { asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  conversations,
  messageFlags,
  reports,
  users,
  type ReportStatus,
} from "@/lib/db/schema";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { trimAdminReason } from "@/lib/admin/account-moderation";

const severityCase = sql`
  CASE ${reports.reason}
    WHEN 'trafficking_concern' THEN 0
    WHEN 'underage_concern' THEN 1
    WHEN 'asked_for_documents' THEN 2
    WHEN 'asked_for_money' THEN 3
    WHEN 'scam_or_fake_job' THEN 4
    WHEN 'sexual_content' THEN 5
    WHEN 'harassment' THEN 6
    WHEN 'spam' THEN 7
    ELSE 8
  END
`;

export async function listAdminReports(input: {
  status?: ReportStatus | "open_queue" | "all";
  limit?: number;
}): Promise<
  Array<{
    id: string;
    reason: string;
    status: ReportStatus;
    details: string | null;
    reporterUserId: string | null;
    reportedUserId: string | null;
    reporterName: string | null;
    reportedName: string | null;
    contactRequestId: string | null;
    conversationId: string | null;
    createdAt: string;
    resolutionNote: string | null;
  }>
> {
  const limit = input.limit ?? 100;
  const statusFilter =
    input.status === "open_queue" || input.status == null
      ? inArray(reports.status, ["open", "reviewing"])
      : input.status === "all"
        ? undefined
        : eq(reports.status, input.status);

  const reporterAlias = users;
  const rows = await db
    .select({
      id: reports.id,
      reason: reports.reason,
      status: reports.status,
      details: reports.details,
      reporterUserId: reports.reporterUserId,
      reportedUserId: reports.reportedUserId,
      contactRequestId: reports.contactRequestId,
      conversationId: reports.conversationId,
      createdAt: reports.createdAt,
      resolutionNote: reports.resolutionNote,
    })
    .from(reports)
    .where(statusFilter)
    .orderBy(asc(severityCase), asc(reports.createdAt))
    .limit(limit);

  const userIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.reporterUserId, r.reportedUserId])
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const nameRows =
    userIds.length === 0
      ? []
      : await db
          .select({ id: reporterAlias.id, name: reporterAlias.name })
          .from(reporterAlias)
          .where(inArray(reporterAlias.id, userIds));

  const names = new Map(nameRows.map((r) => [r.id, r.name]));

  return rows.map((row) => ({
    ...row,
    reporterName: row.reporterUserId
      ? (names.get(row.reporterUserId) ?? null)
      : null,
    reportedName: row.reportedUserId
      ? (names.get(row.reportedUserId) ?? null)
      : null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function resolveReport(input: {
  reportId: string;
  status: "actioned" | "dismissed" | "reviewing";
  note?: string | null;
  actorUserId: string;
  actorEmail: string;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const now = input.now ?? new Date();
  const note =
    input.status === "reviewing"
      ? input.note?.trim() || null
      : trimAdminReason(input.note);

  if (input.status !== "reviewing" && !note) {
    return {
      ok: false,
      status: 400,
      error: "A note is required for actioned or dismissed.",
    };
  }

  const [existing] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, input.reportId))
    .limit(1);

  if (!existing) {
    return { ok: false, status: 404, error: "Report not found." };
  }

  await db
    .update(reports)
    .set({
      status: input.status,
      resolutionNote: note,
      resolvedBy:
        input.status === "reviewing" ? existing.resolvedBy : input.actorEmail,
      resolvedAt: input.status === "reviewing" ? existing.resolvedAt : now,
    })
    .where(eq(reports.id, input.reportId));

  await recordAdminAuditEvent({
    action: "report_resolved",
    actorAdminEmail: input.actorEmail,
    actorUserId: input.actorUserId,
    targetUserId: existing.reportedUserId,
    targetType: "report",
    targetId: existing.id,
    reason: note,
    metadata: {
      before: existing.status,
      after: input.status,
      reportReason: existing.reason,
    },
    createdAt: now,
  });

  return { ok: true };
}

export async function countOpenReportsForAdmin(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(reports)
    .where(inArray(reports.status, ["open", "reviewing"]));
  return Number(row?.value ?? 0);
}

export async function countOpenFlagsForAdmin(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(messageFlags)
    .where(eq(messageFlags.status, "open"));
  return Number(row?.value ?? 0);
}

export async function listAdminFlags(input: {
  status?: "open" | "dismissed" | "actioned" | "all";
  limit?: number;
}): Promise<
  Array<{
    id: string;
    targetType: string;
    status: string;
    categories: string[];
    matchedTerms: string[];
    excerpt: string | null;
    conversationId: string | null;
    contactRequestId: string | null;
    authorUserId: string | null;
    createdAt: string;
  }>
> {
  const limit = input.limit ?? 100;
  const statusFilter =
    input.status == null || input.status === "open"
      ? eq(messageFlags.status, "open")
      : input.status === "all"
        ? undefined
        : eq(messageFlags.status, input.status);

  const rows = await db
    .select()
    .from(messageFlags)
    .where(statusFilter)
    .orderBy(asc(messageFlags.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    targetType: row.targetType,
    status: row.status,
    categories: row.categories,
    matchedTerms: row.matchedTerms,
    excerpt: row.excerpt,
    conversationId: row.conversationId,
    contactRequestId: row.contactRequestId,
    authorUserId: row.authorUserId,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function reviewMessageFlag(input: {
  flagId: string;
  status: "dismissed" | "actioned";
  actorUserId: string;
  actorEmail: string;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const now = input.now ?? new Date();
  const [existing] = await db
    .select()
    .from(messageFlags)
    .where(eq(messageFlags.id, input.flagId))
    .limit(1);

  if (!existing) {
    return { ok: false, status: 404, error: "Flag not found." };
  }

  await db
    .update(messageFlags)
    .set({
      status: input.status,
      reviewedBy: input.actorEmail,
      reviewedAt: now,
    })
    .where(eq(messageFlags.id, input.flagId));

  await recordAdminAuditEvent({
    action: "message_flag_reviewed",
    actorAdminEmail: input.actorEmail,
    actorUserId: input.actorUserId,
    targetUserId: existing.authorUserId,
    targetType: "message_flag",
    targetId: existing.id,
    reason: input.status,
    metadata: {
      before: existing.status,
      after: input.status,
      categories: existing.categories,
    },
    createdAt: now,
  });

  return { ok: true };
}

export async function closeConversationAsAdmin(input: {
  conversationId: string;
  actorUserId: string;
  actorEmail: string;
  reason: string;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const reason = trimAdminReason(input.reason);
  if (!reason) {
    return { ok: false, status: 400, error: "A reason is required." };
  }
  const now = input.now ?? new Date();
  const [updated] = await db
    .update(conversations)
    .set({ status: "closed" })
    .where(eq(conversations.id, input.conversationId))
    .returning({ id: conversations.id });

  if (!updated) {
    return { ok: false, status: 404, error: "Conversation not found." };
  }

  await recordAdminAuditEvent({
    action: "report_resolved",
    actorAdminEmail: input.actorEmail,
    actorUserId: input.actorUserId,
    targetType: "conversation",
    targetId: input.conversationId,
    reason,
    metadata: { action: "conversation_closed" },
    createdAt: now,
  });

  return { ok: true };
}

export async function listReportsForUser(userId: string): Promise<{
  against: Array<{
    id: string;
    reason: string;
    status: string;
    createdAt: string;
  }>;
  by: Array<{
    id: string;
    reason: string;
    status: string;
    createdAt: string;
  }>;
}> {
  const against = await db
    .select({
      id: reports.id,
      reason: reports.reason,
      status: reports.status,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.reportedUserId, userId))
    .orderBy(asc(reports.createdAt));

  const by = await db
    .select({
      id: reports.id,
      reason: reports.reason,
      status: reports.status,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.reporterUserId, userId))
    .orderBy(asc(reports.createdAt));

  return {
    against: against.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    by: by.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
