"use server";

import { auth } from "@/lib/auth";
import { db, profileInterests, hireOutcomes } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getEffectiveStatus } from "@/lib/hire-outcomes";
import { requestConfirmation } from "@/lib/hire-outcomes/service";
import { getLatestConfirmationRequestForInterest } from "@/lib/hire-outcomes/queries";

const requestConfirmationSchema = z.object({
  interestId: z.string().uuid(),
});

interface ActionResult {
  success: boolean;
  error?: string;
  alreadyPending?: boolean;
  requestId?: string;
}

async function getAuthenticatedRecruiter(): Promise<{ userId: string } | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "recruiter") {
    return null;
  }
  return { userId: session.user.id };
}

async function requestOutcomeConfirmation(
  interestId: string,
  requestedStatus: "hired" | "started"
): Promise<ActionResult> {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = requestConfirmationSchema.safeParse({ interestId });
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const result = await requestConfirmation({
    recruiterUserId: recruiter.userId,
    recruiterRole: "recruiter",
    interestId: validation.data.interestId,
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
  interestId: string
): Promise<ActionResult> {
  return requestOutcomeConfirmation(interestId, "hired");
}

export async function requestStartConfirmation(
  interestId: string
): Promise<ActionResult> {
  return requestOutcomeConfirmation(interestId, "started");
}

export async function getInterestWithOutcome(interestId: string) {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter) {
    return null;
  }

  const [interest] = await db
    .select()
    .from(profileInterests)
    .where(eq(profileInterests.id, interestId))
    .limit(1);

  if (!interest || interest.recruiterUserId !== recruiter.userId) {
    return null;
  }

  const [outcome] = await db
    .select()
    .from(hireOutcomes)
    .where(eq(hireOutcomes.interestId, interestId))
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
