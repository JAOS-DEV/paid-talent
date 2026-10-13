/**
 * Pure env checks for LINE Login + Messaging API.
 * When unset, all LINE features no-op and the app falls back to email/in-app.
 */

export function isLineLoginConfigured(): boolean {
  return Boolean(
    process.env.LINE_LOGIN_CHANNEL_ID?.trim() &&
      process.env.LINE_LOGIN_CHANNEL_SECRET?.trim()
  );
}

export function isLineMessagingConfigured(): boolean {
  return Boolean(
    process.env.LINE_MESSAGING_CHANNEL_SECRET?.trim() &&
      process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim()
  );
}

export function getLineLoginChannelId(): string | null {
  const value = process.env.LINE_LOGIN_CHANNEL_ID?.trim();
  return value || null;
}

export function getLineLoginChannelSecret(): string | null {
  const value = process.env.LINE_LOGIN_CHANNEL_SECRET?.trim();
  return value || null;
}

export function getLineMessagingChannelSecret(): string | null {
  const value = process.env.LINE_MESSAGING_CHANNEL_SECRET?.trim();
  return value || null;
}

export function getLineMessagingChannelAccessToken(): string | null {
  const value = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim();
  return value || null;
}

/** Basic ID like @123abcde for https://line.me/R/ti/p/{id} */
export function getLineOaBasicId(): string | null {
  const value = process.env.LINE_OA_BASIC_ID?.trim();
  return value || null;
}

export function getLineOaAddFriendUrl(): string | null {
  const basicId = getLineOaBasicId();
  if (!basicId) return null;
  const id = basicId.startsWith("@") ? basicId : `@${basicId}`;
  return `https://line.me/R/ti/p/${id}`;
}

export function getLineLinkCallbackUrl(): string {
  const base = (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/api/line/link/callback`;
}
