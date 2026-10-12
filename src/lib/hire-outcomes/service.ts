import { and, eq, or } from "drizzle-orm";
import {
  contactRequests,
  db,
  hireOutcomeConfirmationRequests,
  hireOutcomes,
  profileInterests,
  workerProfiles,
} from "@/lib/db";
import type { HireOutcomeStatus } from "@/lib/db/schema";
import { getEffectiveStatus } from "./index";
import {
  buildConfirmationWritePlan,
  canRequestConfirmation,
  canRespondToConfirmation,
  type ConfirmationRequestedStatus,
} from "./confirmations";

export interface MutationResult {
  success: boolean;
  error?: string;
  alreadyPending?: boolean;
  requestId?: string;
  confirmedStatus?: HireOutcomeStatus;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeCode = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    maybeCode === "23505" ||
    message.includes("hire_conf_req_one_pending_per_interest_uidx") ||
    message.toLowerCase().includes("unique")
  );
}

async function getPendingRequestForContactRequest(contactRequestId: string) {
  const [pending] = await db
    .select()
    .from(hireOutcomeConfirmationRequests)
    .where(
      and(
        or(
          eq(hireOutcomeConfirmationRequests.contactRequestId, contactRequestId),
          eq(hireOutcomeConfirmationRequests.interestId, contactRequestId)
        ),
        eq(hireOutcomeConfirmationRequests.requestStatus, "pending")
      )
    )
    .limit(1);

  return pending ?? null;
}

async function getConfirmedOutcome(contactRequestId: string) {
  const [outcome] = await db
    .select()
    .from(hireOutcomes)
    .where(
      or(
        eq(hireOutcomes.contactRequestId, contactRequestId),
        eq(hireOutcomes.interestId, contactRequestId)
      )
    )
    .limit(1);

  return outcome ?? null;
}

export async function requestConfirmation(input: {
  recruiterUserId: string;
  recruiterRole: string | null | undefined;
  interestId: string;
  requestedStatus: ConfirmationRequestedStatus;
}): Promise<MutationResult> {
  const contactRequestId = input.interestId;

  const [contactRequest] = await db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.id, contactRequestId))
    .limit(1);

  if (!contactRequest) {
    return { success: false, error: "Contact request not found" };
  }

  if (contactRequest.status !== "accepted") {
    return {
      success: false,
      error: "Worker must accept the contact request before hire confirmation",
    };
  }

  // Ensure legacy interest row exists for NOT NULL interest_id FKs.
  await db
    .insert(profileInterests)
    .values({
      id: contactRequest.id,
      recruiterUserId: contactRequest.recruiterUserId,
      workerProfileId: contactRequest.workerProfileId,
      openingId: contactRequest.openingId,
      message: contactRequest.openerText,
      createdAt: contactRequest.createdAt,
    })
    .onConflictDoNothing({ target: profileInterests.id });

  const interest = {
    id: contactRequest.id,
    recruiterUserId: contactRequest.recruiterUserId,
    workerProfileId: contactRequest.workerProfileId,
  };

  const existingOutcome = await getConfirmedOutcome(contactRequestId);
  const confirmedStatus = getEffectiveStatus(existingOutcome);
  const pending = await getPendingRequestForContactRequest(contactRequestId);

  const authz = canRequestConfirmation(
    input.recruiterUserId,
    input.recruiterRole,
    interest,
    confirmedStatus,
    input.requestedStatus,
    Boolean(pending)
  );

  if (!authz.allowed && authz.reason === "pending_exists" && pending) {
    return {
      success: true,
      alreadyPending: true,
      requestId: pending.id,
      confirmedStatus,
    };
  }

  if (!authz.allowed) {
    const errors: Record<typeof authz.reason, string> = {
      authorized: "",
      unauthenticated: "Unauthorized",
      wrong_role: "Only recruiters can request confirmation",
      not_owner: "You can only request confirmation for your own interests",
      invalid_transition: `Cannot request ${input.requestedStatus} while status is ${confirmedStatus}`,
      pending_exists: "A confirmation request is already pending",
    };
    return { success: false, error: errors[authz.reason] };
  }

  try {
    const [created] = await db
      .insert(hireOutcomeConfirmationRequests)
      .values({
        interestId: contactRequest.id,
        contactRequestId: contactRequest.id,
        requestedStatus: input.requestedStatus,
        requestStatus: "pending",
        requestedByRecruiterUserId: input.recruiterUserId,
        requestedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: hireOutcomeConfirmationRequests.id });

    return {
      success: true,
      requestId: created.id,
      confirmedStatus,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existingPending =
        await getPendingRequestForContactRequest(contactRequestId);
      if (existingPending) {
        return {
          success: true,
          alreadyPending: true,
          requestId: existingPending.id,
          confirmedStatus,
        };
      }
    }
    throw error;
  }
}

export async function respondToConfirmation(input: {
  workerUserId: string;
  workerRole: string | null | undefined;
  requestId: string;
  action: "confirm" | "reject";
  rejectionReason?: string;
}): Promise<MutationResult> {
  const [row] = await db
    .select({
      request: hireOutcomeConfirmationRequests,
      interest: profileInterests,
      workerProfile: workerProfiles,
    })
    .from(hireOutcomeConfirmationRequests)
    .innerJoin(
      profileInterests,
      eq(hireOutcomeConfirmationRequests.interestId, profileInterests.id)
    )
    .innerJoin(
      workerProfiles,
      eq(profileInterests.workerProfileId, workerProfiles.id)
    )
    .where(eq(hireOutcomeConfirmationRequests.id, input.requestId))
    .limit(1);

  if (!row) {
    return { success: false, error: "Confirmation request not found" };
  }

  const existingOutcome = await getConfirmedOutcome(row.interest.id);
  const confirmedStatus = getEffectiveStatus(existingOutcome);

  const authz = canRespondToConfirmation(
    input.workerUserId,
    input.workerRole,
    {
      requestStatus: row.request.requestStatus,
      requestedStatus: row.request.requestedStatus,
    },
    row.interest,
    row.workerProfile,
    confirmedStatus
  );

  if (!authz.allowed) {
    const errors: Record<typeof authz.reason, string> = {
      authorized: "",
      unauthenticated: "Unauthorized",
      wrong_role: "Only the talent can respond to this request",
      not_owner: "You can only respond to your own confirmation requests",
      not_pending: "This confirmation request has already been answered",
      invalid_transition: `Cannot ${input.action} ${row.request.requestedStatus} while status is ${confirmedStatus}`,
      not_found: "Confirmation request not found",
    };
    return { success: false, error: errors[authz.reason] };
  }

  const now = new Date();
  const plan = buildConfirmationWritePlan(
    input.action,
    row.request.requestedStatus,
    existingOutcome?.hiredAt ?? null,
    existingOutcome?.startedAt ?? null,
    input.workerUserId,
    now
  );

  const result = await db.transaction(async (tx) => {
    const updated = await tx
      .update(hireOutcomeConfirmationRequests)
      .set({
        requestStatus: plan.requestUpdate.requestStatus,
        respondedAt: plan.requestUpdate.respondedAt,
        respondedByWorkerUserId: plan.requestUpdate.respondedByWorkerUserId,
        rejectionReason:
          input.action === "reject" ? (input.rejectionReason ?? null) : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(hireOutcomeConfirmationRequests.id, input.requestId),
          eq(hireOutcomeConfirmationRequests.requestStatus, "pending")
        )
      )
      .returning({ id: hireOutcomeConfirmationRequests.id });

    if (updated.length === 0) {
      return {
        success: false,
        error: "This confirmation request has already been answered",
      } satisfies MutationResult;
    }

    if (input.action === "confirm" && plan.hireOutcome) {
      const contactRequestId =
        row.request.contactRequestId ?? row.interest.id;
      if (existingOutcome) {
        await tx
          .update(hireOutcomes)
          .set({
            status: plan.hireOutcome.status,
            hiredAt: plan.hireOutcome.hiredAt,
            startedAt: plan.hireOutcome.startedAt,
            contactRequestId,
            updatedAt: now,
          })
          .where(eq(hireOutcomes.id, existingOutcome.id));
      } else {
        await tx.insert(hireOutcomes).values({
          interestId: row.interest.id,
          contactRequestId,
          status: plan.hireOutcome.status,
          hiredAt: plan.hireOutcome.hiredAt,
          startedAt: plan.hireOutcome.startedAt,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      success: true,
      requestId: input.requestId,
      confirmedStatus:
        input.action === "confirm" && plan.hireOutcome
          ? plan.hireOutcome.status
          : confirmedStatus,
    } satisfies MutationResult;
  });

  return result;
}
