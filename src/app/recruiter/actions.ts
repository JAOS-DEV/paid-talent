"use server";

import { db, contactRequests, hireOutcomes } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getEffectiveStatus } from "@/lib/hire-outcomes";
import { requestConfirmation } from "@/lib/hire-outcomes/service";
import { getLatestConfirmationRequestForInterest } from "@/lib/hire-outcomes/queries";
import {
  actionAuthError,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";

const requestConfirmationSchema = z.object({
  contactRequestId: z.string().uuid(),
});

interface ActionResult {
  success: boolean;
  error?: string;
  alreadyPending?: boolean;
  requestId?: string;
}

async function getAuthenticatedRecruiter(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const result = await requireActiveRecruiter();
  if (!result.ok) {
    return actionAuthError(result);
  }
  return { ok: true, userId: result.user.userId };
}

async function requestOutcomeConfirmation(
  contactRequestId: string,
  requestedStatus: "hired" | "started"
): Promise<ActionResult> {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter.ok) {
    return { success: false, error: recruiter.error };
  }

  const validation = requestConfirmationSchema.safeParse({ contactRequestId });
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const result = await requestConfirmation({
    recruiterUserId: recruiter.userId,
    recruiterRole: "recruiter",
    interestId: validation.data.contactRequestId,
    requestedStatus,
  });

  if (result.success) {
    revalidatePath("/recruiter/dashboard");
    revalidatePath("/recruiter/interests");
    revalidatePath("/worker/dashboard");
  }

  return {
    success: result.success,
    error: result.error,
    alreadyPending: result.alreadyPending,
    requestId: result.requestId,
  };
}

export async function requestHireConfirmation(
  contactRequestId: string
): Promise<ActionResult> {
  return requestOutcomeConfirmation(contactRequestId, "hired");
}

export async function requestStartConfirmation(
  contactRequestId: string
): Promise<ActionResult> {
  return requestOutcomeConfirmation(contactRequestId, "started");
}

export async function getInterestWithOutcome(interestId: string) {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter.ok) {
    return null;
  }

  const [interest] = await db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.id, interestId))
    .limit(1);

  if (
    !interest ||
    interest.recruiterUserId !== recruiter.userId ||
    interest.status !== "accepted"
  ) {
    return null;
  }

  const [outcome] = await db
    .select()
    .from(hireOutcomes)
    .where(eq(hireOutcomes.contactRequestId, interestId))
    .limit(1);

  const confirmationRequest =
    await getLatestConfirmationRequestForInterest(interestId);

  return {
    interest,
    hireOutcome: outcome ?? null,
    confirmationRequest,
    effectiveStatus: getEffectiveStatus(outcome),
  };
}
