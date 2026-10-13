import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lineLinks } from "@/lib/db/schema";
import {
  getLineOaAddFriendUrl,
  isLineLoginConfigured,
  isLineMessagingConfigured,
} from "@/lib/line/config";
import { isLineMonthlyBudgetExhausted } from "@/lib/line/usage";

export interface LineLinkStatusPayload {
  lineConfigured: boolean;
  lineMessagingConfigured: boolean;
  lineLink: null | {
    displayName: string | null;
    isFriend: boolean;
  };
  lineBudgetExhausted: boolean;
  lineOaAddFriendUrl: string | null;
}

export async function getLineLinkStatusForUser(
  userId: string
): Promise<LineLinkStatusPayload> {
  const lineConfigured = isLineLoginConfigured();
  const lineMessagingConfigured = isLineMessagingConfigured();

  if (!lineConfigured) {
    return {
      lineConfigured: false,
      lineMessagingConfigured,
      lineLink: null,
      lineBudgetExhausted: false,
      lineOaAddFriendUrl: null,
    };
  }

  const [link] = await db
    .select({
      displayName: lineLinks.displayName,
      isFriend: lineLinks.isFriend,
    })
    .from(lineLinks)
    .where(eq(lineLinks.userId, userId))
    .limit(1);

  const lineBudgetExhausted = lineMessagingConfigured
    ? await isLineMonthlyBudgetExhausted()
    : false;

  return {
    lineConfigured: true,
    lineMessagingConfigured,
    lineLink: link
      ? {
          displayName: link.displayName,
          isFriend: link.isFriend,
        }
      : null,
    lineBudgetExhausted,
    lineOaAddFriendUrl: getLineOaAddFriendUrl(),
  };
}
