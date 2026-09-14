import { count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminAuditEvents, type AdminAuditEvent } from "@/lib/db/schema";

export const ADMIN_ACTIVITY_PAGE_SIZE = 50;

export async function listRecentAdminAuditEvents(
  limit: number = ADMIN_ACTIVITY_PAGE_SIZE,
  offset: number = 0
): Promise<AdminAuditEvent[]> {
  return db
    .select()
    .from(adminAuditEvents)
    .orderBy(desc(adminAuditEvents.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countAdminAuditEvents(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(adminAuditEvents);
  return row?.value ?? 0;
}

export async function listAdminAuditEventsForUser(
  userId: string,
  limit: number = 25
): Promise<AdminAuditEvent[]> {
  return db
    .select()
    .from(adminAuditEvents)
    .where(eq(adminAuditEvents.targetUserId, userId))
    .orderBy(desc(adminAuditEvents.createdAt))
    .limit(limit);
}
