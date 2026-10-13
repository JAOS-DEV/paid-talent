import type { CapDenyReason } from "@/lib/messaging/caps";

export type ContactRequestErrorCode =
  | CapDenyReason
  | "contact_info_blocked"
  | "worker_not_found"
  | "worker_not_searchable"
  | "worker_inactive"
  | "venue_not_allowed"
  | "venue_not_primary"
  | "opening_venue_mismatch"
  | "request_not_found"
  | "invalid_status"
  | "follow_up_too_soon"
  | "follow_up_already_sent"
  | "opener_required"
  | "follow_up_too_long";

export interface ContactRequestServiceError {
  ok: false;
  code: ContactRequestErrorCode;
  status: 403 | 404 | 409 | 422 | 429;
  retryAfter?: Date;
  message: string;
}

const CAP_STATUS: Record<
  CapDenyReason,
  403 | 409 | 422 | 429
> = {
  not_verified: 403,
  paused: 403,
  blocked: 403,
  top_talent_requires_pro: 403,
  opening_attach_requires_pro: 403,
  duplicate: 409,
  decline_cooldown: 422,
  opener_too_long: 422,
  daily_limit: 429,
  weekly_limit: 429,
  pending_limit: 429,
  top_talent_daily_limit: 429,
  new_recruiter_daily_limit: 429,
};

const CAP_MESSAGE: Record<CapDenyReason, string> = {
  not_verified: "Recruiter not verified",
  paused: "Messaging is paused for this account",
  blocked: "You can't contact this person",
  daily_limit: "Daily contact request limit reached",
  weekly_limit: "Weekly contact request limit reached",
  pending_limit: "Pending contact request limit reached",
  top_talent_requires_pro: "Top Talent can only be contacted by Verified Pro recruiters",
  top_talent_daily_limit: "Top Talent daily contact limit reached",
  new_recruiter_daily_limit: "New recruiter daily contact limit reached",
  duplicate: "An open contact request already exists for this worker",
  decline_cooldown: "This worker recently declined. Please wait before trying again",
  opener_too_long: "Opener text is too long",
  opening_attach_requires_pro: "Attaching an opening requires Verified Pro",
};

export function capDenyError(
  reason: CapDenyReason,
  retryAfter?: Date
): ContactRequestServiceError {
  return {
    ok: false,
    code: reason,
    status: CAP_STATUS[reason],
    retryAfter,
    message: CAP_MESSAGE[reason],
  };
}

export function serviceError(
  code: ContactRequestErrorCode,
  status: 403 | 404 | 409 | 422 | 429,
  message: string,
  retryAfter?: Date
): ContactRequestServiceError {
  return { ok: false, code, status, message, retryAfter };
}
