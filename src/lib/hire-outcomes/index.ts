import type { HireOutcomeStatus, ProfileInterest, HireOutcome } from "@/lib/db/schema";

export interface HireOutcomeTransitionResult {
  allowed: boolean;
  reason: string;
}

const VALID_TRANSITIONS: Record<HireOutcomeStatus, HireOutcomeStatus[]> = {
  interested: ["hired"],
  hired: ["started"],
  started: [],
};

export function canTransitionHireOutcomeStatus(
  from: HireOutcomeStatus,
  to: HireOutcomeStatus
): HireOutcomeTransitionResult {
  if (from === to) {
    return {
      allowed: false,
      reason: `Status is already ${from}`,
    };
  }

  const allowedTargets = VALID_TRANSITIONS[from];

  if (allowedTargets.includes(to)) {
    return {
      allowed: true,
      reason: `Transition from ${from} to ${to} is allowed`,
    };
  }

  return {
    allowed: false,
    reason: `Cannot transition from ${from} to ${to}. Allowed transitions: ${allowedTargets.join(", ") || "none"}`,
  };
}

export function getHireOutcomeStatusDescription(
  status: HireOutcomeStatus
): string {
  const descriptions: Record<HireOutcomeStatus, string> = {
    interested: "Recruiter has expressed interest in the worker",
    hired: "Worker has confirmed they were hired",
    started: "Worker has confirmed they have started working",
  };
  return descriptions[status];
}

export function getNextAllowedStatus(
  currentStatus: HireOutcomeStatus
): HireOutcomeStatus | null {
  const nextStatuses = VALID_TRANSITIONS[currentStatus];
  return nextStatuses.length > 0 ? nextStatuses[0] : null;
}

export function isTerminalStatus(status: HireOutcomeStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

export interface RecruiterOwnsInterestCheck {
  isOwner: boolean;
  reason: "owner" | "not_owner" | "unauthenticated";
}

export function recruiterOwnsInterest(
  userId: string | null | undefined,
  interest: Pick<ProfileInterest, "recruiterUserId"> | null
): RecruiterOwnsInterestCheck {
  if (!userId) {
    return {
      isOwner: false,
      reason: "unauthenticated",
    };
  }

  if (!interest) {
    return {
      isOwner: false,
      reason: "not_owner",
    };
  }

  if (interest.recruiterUserId === userId) {
    return {
      isOwner: true,
      reason: "owner",
    };
  }

  return {
    isOwner: false,
    reason: "not_owner",
  };
}

export interface CanUpdateHireOutcomeResult {
  authorized: boolean;
  reason:
    | "authorized"
    | "unauthenticated"
    | "wrong_role"
    | "not_owner"
    | "invalid_transition";
}

export function canUpdateHireOutcome(
  userId: string | null | undefined,
  userRole: string | null | undefined,
  interest: Pick<ProfileInterest, "recruiterUserId"> | null,
  currentStatus: HireOutcomeStatus,
  newStatus: HireOutcomeStatus
): CanUpdateHireOutcomeResult {
  if (!userId) {
    return {
      authorized: false,
      reason: "unauthenticated",
    };
  }

  if (userRole !== "recruiter") {
    return {
      authorized: false,
      reason: "wrong_role",
    };
  }

  const ownerCheck = recruiterOwnsInterest(userId, interest);
  if (!ownerCheck.isOwner) {
    return {
      authorized: false,
      reason: "not_owner",
    };
  }

  const transitionCheck = canTransitionHireOutcomeStatus(currentStatus, newStatus);
  if (!transitionCheck.allowed) {
    return {
      authorized: false,
      reason: "invalid_transition",
    };
  }

  return {
    authorized: true,
    reason: "authorized",
  };
}

export interface HireOutcomeWithTimestamps {
  status: HireOutcomeStatus;
  hiredAt: Date | null;
  startedAt: Date | null;
}

export function computeTimestampsForStatusChange(
  currentOutcome: HireOutcomeWithTimestamps | null,
  newStatus: HireOutcomeStatus
): { hiredAt: Date | null; startedAt: Date | null } {
  const now = new Date();

  if (newStatus === "hired") {
    return {
      hiredAt: now,
      startedAt: currentOutcome?.startedAt ?? null,
    };
  }

  if (newStatus === "started") {
    return {
      hiredAt: currentOutcome?.hiredAt ?? null,
      startedAt: now,
    };
  }

  return {
    hiredAt: currentOutcome?.hiredAt ?? null,
    startedAt: currentOutcome?.startedAt ?? null,
  };
}

export type HireOutcomeFilter = HireOutcomeStatus | "any" | "none";

export interface InterestWithOutcome {
  interest: ProfileInterest;
  hireOutcome: HireOutcome | null;
}

export function filterByHireOutcome(
  interests: InterestWithOutcome[],
  filter: HireOutcomeFilter
): InterestWithOutcome[] {
  if (filter === "any") {
    return interests;
  }

  if (filter === "none") {
    return interests.filter((i) => i.hireOutcome === null);
  }

  return interests.filter(
    (i) => i.hireOutcome !== null && i.hireOutcome.status === filter
  );
}

export function hasHireOutcome(
  outcome: HireOutcome | null | undefined
): outcome is HireOutcome {
  return outcome !== null && outcome !== undefined;
}

export function getEffectiveStatus(
  outcome: HireOutcome | null | undefined
): HireOutcomeStatus {
  if (!hasHireOutcome(outcome)) {
    return "interested";
  }
  return outcome.status;
}

export interface ConfirmedOutcomeStats {
  total: number;
  interested: number;
  hired: number;
  started: number;
}

export function countConfirmedOutcomeStats(
  statuses: Array<HireOutcomeStatus | null | undefined>
): ConfirmedOutcomeStats {
  const stats: ConfirmedOutcomeStats = {
    total: statuses.length,
    interested: 0,
    hired: 0,
    started: 0,
  };

  for (const status of statuses) {
    if (!status || status === "interested") {
      stats.interested++;
    } else if (status === "hired") {
      stats.hired++;
    } else if (status === "started") {
      stats.started++;
    }
  }

  return stats;
}

export {
  canRequestConfirmation,
  canRespondToConfirmation,
  getRequestedStatusForConfirmedStatus,
  getRecruiterRequestAction,
  getRecruiterPendingLabel,
  getRecruiterRejectionLabel,
  getRecruiterRequestButtonLabel,
  getWorkerConfirmationCopy,
  isPendingRequestCompatible,
  confirmationDoesNotTouchAvailability,
  WORKER_AVAILABILITY_FIELDS,
} from "./confirmations";

export type {
  ConfirmationRequestedStatus,
  ConfirmationRequestStatus,
  CanRequestConfirmationResult,
  CanRespondToConfirmationResult,
  RecruiterRequestAction,
  WorkerConfirmationCopy,
  PendingConfirmationView,
} from "./confirmations";
