import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  lt,
  sql,
} from "drizzle-orm";
import { db, type DbClient } from "@/lib/db";
import {
  contactRequests,
  conversations,
  messageFlags,
  notifications,
  reports,
} from "@/lib/db/schema";
import { MS_PER_DAY } from "@/lib/account/constants";
import { getMessagingSettings } from "@/lib/messaging/settings";

export const NOTIFICATION_RETENTION_DAYS = 90;
export const REPORT_EVIDENCE_RETENTION_DAYS = 730;
export const DEFAULT_RETENTION_BATCH_SIZE = 500;

export interface ConversationRetentionRow {
  id: string;
  retentionExpiresAt: Date | null;
  legalHoldUntil: Date | null;
  workerHiddenAt: Date | null;
  recruiterHiddenAt: Date | null;
}

export interface ContactRequestRetentionRow {
  id: string;
  status: string;
  respondedAt: Date | null;
  expiresAt: Date | null;
  updatedAt: Date;
  hasConversation: boolean;
  hasActiveLegalHoldReport: boolean;
}

export interface NotificationRetentionRow {
  id: string;
  createdAt: Date;
}

export interface FlagRetentionRow {
  id: string;
  targetType: string;
  status: string;
  createdAt: Date;
}

export interface ReportSnapshotRetentionRow {
  id: string;
  resolvedAt: Date | null;
  hasEvidenceSnapshot: boolean;
}

export interface MessagingRetentionCounts {
  conversationsDeleted: number;
  contactRequestsDeleted: number;
  notificationsDeleted: number;
  messageFlagsDeleted: number;
  reportSnapshotsCleared: number;
}

export interface MessagingRetentionStore {
  retentionDays(): Promise<number>;
  listConversations(
    now: Date,
    limit: number,
    afterId: string | null
  ): Promise<ConversationRetentionRow[]>;
  deleteConversations(ids: string[]): Promise<void>;
  listContactRequests(
    now: Date,
    limit: number,
    afterId: string | null
  ): Promise<ContactRequestRetentionRow[]>;
  deleteContactRequests(ids: string[]): Promise<void>;
  listNotifications(
    limit: number,
    afterId: string | null
  ): Promise<NotificationRetentionRow[]>;
  deleteNotifications(ids: string[]): Promise<void>;
  listFlags(limit: number, afterId: string | null): Promise<FlagRetentionRow[]>;
  deleteFlags(ids: string[]): Promise<void>;
  listReports(
    limit: number,
    afterId: string | null
  ): Promise<ReportSnapshotRetentionRow[]>;
  clearReportSnapshots(ids: string[]): Promise<void>;
}

/**
 * Expired conversations are deleted unless a legal hold is still in force.
 * Hiding a chat does not change retention.
 */
export function isConversationDueForDeletion(
  row: ConversationRetentionRow,
  now: Date
): boolean {
  if (
    !row.retentionExpiresAt ||
    row.retentionExpiresAt.getTime() >= now.getTime()
  ) {
    return false;
  }
  if (row.legalHoldUntil && row.legalHoldUntil.getTime() >= now.getTime()) {
    return false;
  }
  return true;
}

export function contactRequestRetentionAnchor(
  row: Pick<ContactRequestRetentionRow, "respondedAt" | "expiresAt" | "updatedAt">
): Date {
  return row.respondedAt ?? row.expiresAt ?? row.updatedAt;
}

export function isContactRequestDueForDeletion(
  row: ContactRequestRetentionRow,
  now: Date,
  retentionDays: number
): boolean {
  if (
    row.status !== "declined" &&
    row.status !== "withdrawn" &&
    row.status !== "expired"
  ) {
    return false;
  }
  if (row.hasConversation || row.hasActiveLegalHoldReport) {
    return false;
  }
  const cutoff = now.getTime() - retentionDays * MS_PER_DAY;
  return contactRequestRetentionAnchor(row).getTime() < cutoff;
}

export function isNotificationDueForDeletion(
  row: NotificationRetentionRow,
  now: Date
): boolean {
  const cutoff = now.getTime() - NOTIFICATION_RETENTION_DAYS * MS_PER_DAY;
  return row.createdAt.getTime() < cutoff;
}

export function isBlockedAttemptFlagDueForDeletion(
  row: FlagRetentionRow,
  now: Date,
  retentionDays: number
): boolean {
  if (row.targetType !== "blocked_attempt" || row.status === "open") {
    return false;
  }
  const cutoff = now.getTime() - retentionDays * MS_PER_DAY;
  return row.createdAt.getTime() < cutoff;
}

export function isReportSnapshotDueForClear(
  row: ReportSnapshotRetentionRow,
  now: Date
): boolean {
  if (!row.resolvedAt || !row.hasEvidenceSnapshot) {
    return false;
  }
  const cutoff = now.getTime() - REPORT_EVIDENCE_RETENTION_DAYS * MS_PER_DAY;
  return row.resolvedAt.getTime() < cutoff;
}

async function drainPages<T extends { id: string }>(
  batchSize: number,
  list: (limit: number, afterId: string | null) => Promise<T[]>,
  isDue: (row: T) => boolean,
  remove: (ids: string[]) => Promise<void>
): Promise<number> {
  let deleted = 0;
  let afterId: string | null = null;

  for (;;) {
    const page = await list(batchSize, afterId);
    if (page.length === 0) {
      return deleted;
    }
    afterId = page[page.length - 1]?.id ?? afterId;
    const dueIds = page.filter(isDue).map((row) => row.id);
    if (dueIds.length > 0) {
      await remove(dueIds);
      deleted += dueIds.length;
    }
    if (page.length < batchSize) {
      return deleted;
    }
  }
}

export async function runMessagingRetention(
  now: Date = new Date(),
  options: { batchSize?: number; store?: MessagingRetentionStore } = {}
): Promise<MessagingRetentionCounts> {
  const batchSize = options.batchSize ?? DEFAULT_RETENTION_BATCH_SIZE;
  const store = options.store ?? createDrizzleMessagingRetentionStore();
  const retentionDays = await store.retentionDays();

  const conversationsDeleted = await drainPages(
    batchSize,
    (limit, afterId) => store.listConversations(now, limit, afterId),
    (row) => isConversationDueForDeletion(row, now),
    (ids) => store.deleteConversations(ids)
  );
  const contactRequestsDeleted = await drainPages(
    batchSize,
    (limit, afterId) => store.listContactRequests(now, limit, afterId),
    (row) => isContactRequestDueForDeletion(row, now, retentionDays),
    (ids) => store.deleteContactRequests(ids)
  );
  const notificationsDeleted = await drainPages(
    batchSize,
    (limit, afterId) => store.listNotifications(limit, afterId),
    (row) => isNotificationDueForDeletion(row, now),
    (ids) => store.deleteNotifications(ids)
  );
  const messageFlagsDeleted = await drainPages(
    batchSize,
    (limit, afterId) => store.listFlags(limit, afterId),
    (row) => isBlockedAttemptFlagDueForDeletion(row, now, retentionDays),
    (ids) => store.deleteFlags(ids)
  );
  const reportSnapshotsCleared = await drainPages(
    batchSize,
    (limit, afterId) => store.listReports(limit, afterId),
    (row) => isReportSnapshotDueForClear(row, now),
    (ids) => store.clearReportSnapshots(ids)
  );

  return {
    conversationsDeleted,
    contactRequestsDeleted,
    notificationsDeleted,
    messageFlagsDeleted,
    reportSnapshotsCleared,
  };
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

export function createDrizzleMessagingRetentionStore(
  client: DbClient = db
): MessagingRetentionStore {
  return {
    async retentionDays() {
      const settings = await getMessagingSettings();
      return settings.retentionDays;
    },
    async listConversations(now, limit, afterId) {
      const conditions = [
        isNotNull(conversations.retentionExpiresAt),
        lt(conversations.retentionExpiresAt, now),
      ];
      if (afterId) {
        conditions.push(gt(conversations.id, afterId));
      }
      return client
        .select({
          id: conversations.id,
          retentionExpiresAt: conversations.retentionExpiresAt,
          legalHoldUntil: conversations.legalHoldUntil,
          workerHiddenAt: conversations.workerHiddenAt,
          recruiterHiddenAt: conversations.recruiterHiddenAt,
        })
        .from(conversations)
        .where(and(...conditions))
        .orderBy(conversations.id)
        .limit(limit);
    },
    async deleteConversations(ids) {
      if (ids.length === 0) return;
      await client
        .delete(conversations)
        .where(inArray(conversations.id, ids));
    },
    async listContactRequests(now, limit, afterId) {
      const conditions = [
        inArray(contactRequests.status, ["declined", "withdrawn", "expired"]),
      ];
      if (afterId) {
        conditions.push(gt(contactRequests.id, afterId));
      }
      const rows = await client
        .select({
          id: contactRequests.id,
          status: contactRequests.status,
          respondedAt: contactRequests.respondedAt,
          expiresAt: contactRequests.expiresAt,
          updatedAt: contactRequests.updatedAt,
          hasConversation: sql<boolean>`exists (select 1 from conversations c where c.contact_request_id = ${contactRequests.id})`,
          hasActiveLegalHoldReport: sql<boolean>`exists (
            select 1 from reports r
            inner join conversations held on held.id = r.conversation_id
            where r.contact_request_id = ${contactRequests.id}
              and held.legal_hold_until is not null
              and held.legal_hold_until > ${now}
          )`,
        })
        .from(contactRequests)
        .where(and(...conditions))
        .orderBy(contactRequests.id)
        .limit(limit);

      return rows.map((row) => ({
        ...row,
        hasConversation: asBoolean(row.hasConversation),
        hasActiveLegalHoldReport: asBoolean(row.hasActiveLegalHoldReport),
      }));
    },
    async deleteContactRequests(ids) {
      if (ids.length === 0) return;
      await client
        .delete(contactRequests)
        .where(inArray(contactRequests.id, ids));
    },
    async listNotifications(limit, afterId) {
      const query = client
        .select({
          id: notifications.id,
          createdAt: notifications.createdAt,
        })
        .from(notifications);
      const filtered = afterId
        ? query.where(gt(notifications.id, afterId))
        : query;
      return filtered.orderBy(notifications.id).limit(limit);
    },
    async deleteNotifications(ids) {
      if (ids.length === 0) return;
      await client.delete(notifications).where(inArray(notifications.id, ids));
    },
    async listFlags(limit, afterId) {
      const conditions = [eq(messageFlags.targetType, "blocked_attempt")];
      if (afterId) {
        conditions.push(gt(messageFlags.id, afterId));
      }
      return client
        .select({
          id: messageFlags.id,
          targetType: messageFlags.targetType,
          status: messageFlags.status,
          createdAt: messageFlags.createdAt,
        })
        .from(messageFlags)
        .where(and(...conditions))
        .orderBy(messageFlags.id)
        .limit(limit);
    },
    async deleteFlags(ids) {
      if (ids.length === 0) return;
      await client.delete(messageFlags).where(inArray(messageFlags.id, ids));
    },
    async listReports(limit, afterId) {
      const query = client
        .select({
          id: reports.id,
          resolvedAt: reports.resolvedAt,
          evidenceSnapshot: reports.evidenceSnapshot,
        })
        .from(reports);
      const filtered = afterId ? query.where(gt(reports.id, afterId)) : query;
      const rows = await filtered.orderBy(reports.id).limit(limit);
      return rows.map((row) => ({
        id: row.id,
        resolvedAt: row.resolvedAt,
        hasEvidenceSnapshot: row.evidenceSnapshot != null,
      }));
    },
    async clearReportSnapshots(ids) {
      if (ids.length === 0) return;
      await client
        .update(reports)
        .set({ evidenceSnapshot: null })
        .where(inArray(reports.id, ids));
    },
  };
}
