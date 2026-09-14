import type {
  HireOutcomeStatus,
  ProfileInterest,
  WorkerProfile,
} from "@/lib/db/schema";

export type ConfirmationRequestedStatus = "hired" | "started";
export type ConfirmationRequestStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "cancelled";

export const WORKER_AVAILABILITY_FIELDS = [
  "isPublished",
  "availability",
] as const;

export function confirmationDoesNotTouchAvailability(): boolean {
  return true;
}

export interface CanRequestConfirmationResult {
  allowed: boolean;
  reason:
    | "authorized"
    | "unauthenticated"
    | "wrong_role"
    | "not_owner"
    | "invalid_transition"
    | "pending_exists";
}

export function getRequestedStatusForConfirmedStatus(
  confirmedStatus: HireOutcomeStatus
): ConfirmationRequestedStatus | null {
  if (confirmedStatus === "interested") return "hired";
  if (confirmedStatus === "hired") return "started";
  return null;
}

export function canRequestConfirmation(
  userId: string | null | undefined,
  userRole: string | null | undefined,
  interest: Pick<ProfileInterest, "recruiterUserId"> | null,
  confirmedStatus: HireOutcomeStatus,
  requestedStatus: ConfirmationRequestedStatus,
  hasPendingRequest: boolean
): CanRequestConfirmationResult {
  if (!userId) {
    return { allowed: false, reason: "unauthenticated" };
  }

  if (userRole !== "recruiter") {
    return { allowed: false, reason: "wrong_role" };
  }

  if (!interest || interest.recruiterUserId !== userId) {
    return { allowed: false, reason: "not_owner" };
  }

  if (!isPendingRequestCompatible(confirmedStatus, requestedStatus)) {
    return { allowed: false, reason: "invalid_transition" };
  }

  if (hasPendingRequest) {
    return { allowed: false, reason: "pending_exists" };
  }

  return { allowed: true, reason: "authorized" };
}

export interface CanRespondToConfirmationResult {
  allowed: boolean;
  reason:
    | "authorized"
    | "unauthenticated"
    | "wrong_role"
    | "not_owner"
    | "not_pending"
    | "invalid_transition"
    | "not_found";
}

export function canRespondToConfirmation(
  userId: string | null | undefined,
  userRole: string | null | undefined,
  request: {
    requestStatus: ConfirmationRequestStatus;
    requestedStatus: ConfirmationRequestedStatus;
  } | null,
  interest: Pick<ProfileInterest, "workerProfileId"> | null,
  workerProfile: Pick<WorkerProfile, "id" | "userId"> | null,
  confirmedStatus: HireOutcomeStatus
): CanRespondToConfirmationResult {
  if (!userId) {
    return { allowed: false, reason: "unauthenticated" };
  }

  if (userRole !== "worker") {
    return { allowed: false, reason: "wrong_role" };
  }

  if (!request || !interest || !workerProfile) {
    return { allowed: false, reason: "not_found" };
  }

  if (workerProfile.userId !== userId) {
    return { allowed: false, reason: "not_owner" };
  }

  if (interest.workerProfileId !== workerProfile.id) {
    return { allowed: false, reason: "not_owner" };
  }

  if (request.requestStatus !== "pending") {
    return { allowed: false, reason: "not_pending" };
  }

  if (!isPendingRequestCompatible(confirmedStatus, request.requestedStatus)) {
    return { allowed: false, reason: "invalid_transition" };
  }

  return { allowed: true, reason: "authorized" };
}

export function isPendingRequestCompatible(
  confirmedStatus: HireOutcomeStatus,
  requestedStatus: ConfirmationRequestedStatus
): boolean {
  if (requestedStatus === "hired") {
    return confirmedStatus === "interested";
  }
  if (requestedStatus === "started") {
    return confirmedStatus === "hired";
  }
  return false;
}

export type RecruiterRequestAction = "request-hire" | "request-start";

export function getRecruiterRequestAction(
  confirmedStatus: HireOutcomeStatus,
  pendingRequestedStatus: ConfirmationRequestedStatus | null
): RecruiterRequestAction | null {
  if (pendingRequestedStatus) {
    return null;
  }
  if (confirmedStatus === "interested") return "request-hire";
  if (confirmedStatus === "hired") return "request-start";
  return null;
}

export function getRecruiterRequestButtonLabel(
  action: RecruiterRequestAction | null
): string | null {
  if (action === "request-hire") return "Request hire confirmation";
  if (action === "request-start") return "Request start confirmation";
  return null;
}

export function getRecruiterPendingLabel(
  requestedStatus: ConfirmationRequestedStatus | null
): string | null {
  if (requestedStatus === "hired") return "Awaiting talent confirmation";
  if (requestedStatus === "started") return "Awaiting start confirmation";
  return null;
}

export function getRecruiterRejectionLabel(
  requestedStatus: ConfirmationRequestedStatus | null
): string | null {
  if (requestedStatus === "hired") return "Talent did not confirm the hire";
  if (requestedStatus === "started") {
    return "Talent did not confirm they have started";
  }
  return null;
}

export interface WorkerConfirmationCopy {
  heading: string;
  statement: string;
  prompt: string;
  confirmLabel: string;
  rejectLabel: string;
}

export function getWorkerConfirmationCopy(
  venueName: string,
  requestedStatus: ConfirmationRequestedStatus
): WorkerConfirmationCopy {
  const venue = venueName.trim() || "A venue";

  if (requestedStatus === "hired") {
    return {
      heading: "Action required",
      statement: `${venue} says they have hired you.`,
      prompt: "Please confirm whether this is correct.",
      confirmLabel: "Confirm hired",
      rejectLabel: "This isn't correct",
    };
  }

  return {
    heading: "Action required",
    statement: `${venue} says you have started working with them.`,
    prompt: "Have you started this job?",
    confirmLabel: "Confirm started",
    rejectLabel: "Not yet / This isn't correct",
  };
}

export interface PendingConfirmationView {
  id: string;
  requestedStatus: ConfirmationRequestedStatus;
  requestStatus: ConfirmationRequestStatus;
  requestedAt: Date | string;
  venueName: string;
  openingContext: string | null;
}

export function resolveVenueName(
  organizationName: string | null | undefined,
  recruiterName: string | null | undefined
): string {
  const organization = organizationName?.trim();
  if (organization) return organization;
  const name = recruiterName?.trim();
  if (name) return name;
  return "A venue";
}

export function resolveOpeningContext(
  role: string | null | undefined,
  area: string | null | undefined
): string | null {
  const trimmedRole = role?.trim();
  const trimmedArea = area?.trim();
  if (trimmedRole && trimmedArea) {
    return `${trimmedRole} — ${trimmedArea}`;
  }
  if (trimmedRole) return trimmedRole;
  if (trimmedArea) return trimmedArea;
  return null;
}

export function pickLatestConfirmationRequest<
  T extends {
    requestStatus: ConfirmationRequestStatus;
    requestedAt: Date | string;
  },
>(requests: T[]): T | null {
  if (requests.length === 0) return null;
  const pending = requests.find((request) => request.requestStatus === "pending");
  if (pending) return pending;

  return [...requests].sort((a, b) => {
    const aTime = new Date(a.requestedAt).getTime();
    const bTime = new Date(b.requestedAt).getTime();
    return bTime - aTime;
  })[0];
}

export interface ConfirmationWritePlan {
  requestUpdate: {
    requestStatus: "confirmed" | "rejected";
    respondedAt: Date;
    respondedByWorkerUserId: string;
  };
  hireOutcome:
    | {
        status: ConfirmationRequestedStatus;
        hiredAt: Date | null;
        startedAt: Date | null;
      }
    | null;
  workerProfileUpdate: null;
}

export function buildConfirmationWritePlan(
  action: "confirm" | "reject",
  requestedStatus: ConfirmationRequestedStatus,
  currentHiredAt: Date | null,
  currentStartedAt: Date | null,
  workerUserId: string,
  confirmedAt: Date
): ConfirmationWritePlan {
  const requestUpdate = {
    requestStatus: action === "confirm" ? ("confirmed" as const) : ("rejected" as const),
    respondedAt: confirmedAt,
    respondedByWorkerUserId: workerUserId,
  };

  if (action === "reject") {
    return {
      requestUpdate,
      hireOutcome: null,
      workerProfileUpdate: null,
    };
  }

  if (requestedStatus === "hired") {
    return {
      requestUpdate,
      hireOutcome: {
        status: "hired",
        hiredAt: confirmedAt,
        startedAt: currentStartedAt,
      },
      workerProfileUpdate: null,
    };
  }

  return {
    requestUpdate,
    hireOutcome: {
      status: "started",
      hiredAt: currentHiredAt,
      startedAt: confirmedAt,
    },
    workerProfileUpdate: null,
  };
}
