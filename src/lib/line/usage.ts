import { and, eq, sql } from "drizzle-orm";
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

/**
 * Atomically reserve one push slot for the Bangkok month.
 * Upserts the month row first, then increments only if under budget.
 */
export async function reserveLinePushBudget(
  budget: number,
  now: Date = new Date(),
  client: DbClient = db
): Promise<
  { ok: true; pushesSent: number } | { ok: false; reason: "budget_exhausted" }
> {
  const month = bangkokMonthKey(now);
  const updatedAt = now;

  await client
    .insert(linePushUsage)
    .values({
      month,
      pushesSent: 0,
      updatedAt,
    })
    .onConflictDoNothing({ target: linePushUsage.month });

  const [row] = await client
    .update(linePushUsage)
    .set({
      pushesSent: sql`${linePushUsage.pushesSent} + 1`,
      updatedAt,
    })
    .where(
      and(
        eq(linePushUsage.month, month),
        sql`${linePushUsage.pushesSent} < ${budget}`
      )
    )
    .returning({ pushesSent: linePushUsage.pushesSent });

  if (!row) {
    return { ok: false, reason: "budget_exhausted" };
  }
  return { ok: true, pushesSent: row.pushesSent };
}

/** Release a previously reserved slot after a failed push. */
export async function releaseLinePushBudget(
  now: Date = new Date(),
  client: DbClient = db
): Promise<void> {
  const month = bangkokMonthKey(now);
  await client
    .update(linePushUsage)
    .set({
      pushesSent: sql`GREATEST(${linePushUsage.pushesSent} - 1, 0)`,
      updatedAt: now,
    })
    .where(eq(linePushUsage.month, month));
}
