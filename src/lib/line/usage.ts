import { eq, sql } from "drizzle-orm";
import { db, type DbClient } from "@/lib/db";
import { linePushUsage } from "@/lib/db/schema";
import { bangkokMonthKey } from "@/lib/line/bangkok-month";
import { getMessagingSettings } from "@/lib/messaging/settings";

export async function getLinePushesSentThisMonth(
  now: Date = new Date(),
  client: DbClient = db
): Promise<number> {
  const month = bangkokMonthKey(now);
  const [row] = await client
    .select({ pushesSent: linePushUsage.pushesSent })
    .from(linePushUsage)
    .where(eq(linePushUsage.month, month))
    .limit(1);
  return row?.pushesSent ?? 0;
}

export async function isLineMonthlyBudgetExhausted(
  now: Date = new Date()
): Promise<boolean> {
  const [settings, sent] = await Promise.all([
    getMessagingSettings(now.getTime()),
    getLinePushesSentThisMonth(now),
  ]);
  return sent >= settings.lineMonthlyPushBudget;
}

export async function incrementLinePushUsage(
  now: Date = new Date(),
  client: DbClient = db
): Promise<void> {
  const month = bangkokMonthKey(now);
  const updatedAt = now;
  await client
    .insert(linePushUsage)
    .values({
      month,
      pushesSent: 1,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: linePushUsage.month,
      set: {
        pushesSent: sql`${linePushUsage.pushesSent} + 1`,
        updatedAt,
      },
    });
}
