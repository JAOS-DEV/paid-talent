export type ConversationErrorCode =
  | "conversation_not_found"
  | "conversation_closed"
  | "contact_info_blocked"
  | "message_empty"
  | "message_too_long"
  | "rate_limited"
  | "no_value"
  | "invalid_channel";

export interface ConversationServiceError {
  ok: false;
  code: ConversationErrorCode;
  status: 400 | 404 | 409 | 422 | 429;
  message: string;
  nudge?: "use_share_button";
}

export function conversationError(
  code: ConversationErrorCode,
  status: 400 | 404 | 409 | 422 | 429,
  message: string,
  extra?: { nudge?: "use_share_button" }
): ConversationServiceError {
  return { ok: false, code, status, message, ...extra };
}
