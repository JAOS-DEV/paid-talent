"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { respondToConfirmation } from "@/lib/hire-outcomes/service";
import { getPendingConfirmationRequestsForWorker } from "@/lib/hire-outcomes/queries";

const requestIdSchema = z.object({
  requestId: z.string().uuid(),
});

interface ActionResult {
  success: boolean;
  error?: string;
  confirmedStatus?: string;
}

async function getAuthenticatedWorker(): Promise<{ userId: string } | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "worker") {
    return null;
  }
  return { userId: session.user.id };
}

export async function getPendingHireConfirmations() {
  const worker = await getAuthenticatedWorker();
  if (!worker) {
    return [];
  }
  return getPendingConfirmationRequestsForWorker(worker.userId);
}

async function respond(
  requestId: string,
  action: "confirm" | "reject"
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker) {
    return { success: false, error: "Unauthorized" };
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
