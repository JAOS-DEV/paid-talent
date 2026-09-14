"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { respondToConfirmation } from "@/lib/hire-outcomes/service";
import { getPendingConfirmationRequestsForWorker } from "@/lib/hire-outcomes/queries";
import {
  actionAuthError,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";

const requestIdSchema = z.object({
  requestId: z.string().uuid(),
});

interface ActionResult {
  success: boolean;
  error?: string;
  confirmedStatus?: string;
}

async function getAuthenticatedWorker(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const result = await requireActiveWorker();
  if (!result.ok) {
    return actionAuthError(result);
  }
  return { ok: true, userId: result.user.userId };
}

export async function getPendingHireConfirmations() {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return [];
  }
  return getPendingConfirmationRequestsForWorker(worker.userId);
}

async function respond(
  requestId: string,
  action: "confirm" | "reject"
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return { success: false, error: worker.error };
  }

  const validation = requestIdSchema.safeParse({ requestId });
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const result = await respondToConfirmation({
    workerUserId: worker.userId,
    workerRole: "worker",
    requestId: validation.data.requestId,
    action,
  });

  if (result.success) {
    revalidatePath("/worker/dashboard");
    revalidatePath("/recruiter/interests");
    revalidatePath("/recruiter/dashboard");
  }

  return {
    success: result.success,
    error: result.error,
    confirmedStatus: result.confirmedStatus,
  };
}

export async function confirmHireConfirmationRequest(
  requestId: string
): Promise<ActionResult> {
  return respond(requestId, "confirm");
}

export async function rejectHireConfirmationRequest(
  requestId: string
): Promise<ActionResult> {
  return respond(requestId, "reject");
}
