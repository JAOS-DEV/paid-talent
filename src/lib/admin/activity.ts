import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminAuditEvents, type AdminAuditEvent } from "@/lib/db/schema";

export async function listRecentAdminAuditEvents(
  limit: number = 50
): Promise<AdminAuditEvent[]> {
  return db
    .select()
    .from(adminAuditEvents)
    .orderBy(desc(adminAuditEvents.createdAt))
    .limit(limit);
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
