"use server";

import { auth } from "@/lib/auth";
import { db, profileInterests, hireOutcomes } from "@/lib/db";
import type { HireOutcomeStatus } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  canUpdateHireOutcome,
  computeTimestampsForStatusChange,
  getEffectiveStatus,
} from "@/lib/hire-outcomes";

const setHireOutcomeSchema = z.object({
  interestId: z.string().uuid(),
  status: z.enum(["hired", "started"]),
  notes: z.string().max(500).optional(),
});

interface ActionResult {
  success: boolean;
  error?: string;
}

async function getAuthenticatedRecruiter(): Promise<{ userId: string } | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "recruiter") {
    return null;
  }
  return { userId: session.user.id };
}

export async function setHireOutcome(
  data: z.infer<typeof setHireOutcomeSchema>
): Promise<ActionResult> {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = setHireOutcomeSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const { interestId, status, notes } = validation.data;

  const [interest] = await db
    .select()
    .from(profileInterests)
    .where(eq(profileInterests.id, interestId))
    .limit(1);

  if (!interest) {
    return { success: false, error: "Interest not found" };
  }

  const [existingOutcome] = await db
    .select()
    .from(hireOutcomes)
    .where(eq(hireOutcomes.interestId, interestId))
    .limit(1);

  const currentStatus = getEffectiveStatus(existingOutcome);

  const authzCheck = canUpdateHireOutcome(
    recruiter.userId,
    "recruiter",
    interest,
    currentStatus,
    status as HireOutcomeStatus
  );

  if (!authzCheck.authorized) {
    const errorMessages: Record<typeof authzCheck.reason, string> = {
      authorized: "",
      unauthenticated: "Unauthorized",
      wrong_role: "Only recruiters can update hire outcomes",
      not_owner: "You can only update outcomes for your own interests",
      invalid_transition: `Cannot transition from ${currentStatus} to ${status}`,
    };
    return { success: false, error: errorMessages[authzCheck.reason] };
  }

  const timestamps = computeTimestampsForStatusChange(existingOutcome, status as HireOutcomeStatus);

  if (existingOutcome) {
    await db
      .update(hireOutcomes)
      .set({
        status: status as HireOutcomeStatus,
        hiredAt: timestamps.hiredAt,
        startedAt: timestamps.startedAt,
        notes: notes ?? existingOutcome.notes,
        updatedAt: new Date(),
      })
      .where(eq(hireOutcomes.id, existingOutcome.id));
  } else {
    await db.insert(hireOutcomes).values({
      interestId,
      status: status as HireOutcomeStatus,
      hiredAt: timestamps.hiredAt,
      startedAt: timestamps.startedAt,
      notes: notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  console.log(
    `[HireOutcome] Recruiter ${recruiter.userId} set interest ${interestId} to ${status}`
  );

  revalidatePath("/recruiter/dashboard");
  revalidatePath("/recruiter/interests");

  return { success: true };
}

export async function markAsHired(
  interestId: string,
  notes?: string
): Promise<ActionResult> {
  return setHireOutcome({ interestId, status: "hired", notes });
}

export async function markAsStarted(
  interestId: string,
  notes?: string
): Promise<ActionResult> {
  return setHireOutcome({ interestId, status: "started", notes });
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

  return {
    interest,
    hireOutcome: outcome ?? null,
    effectiveStatus: getEffectiveStatus(outcome),
  };
}
