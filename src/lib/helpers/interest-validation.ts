import { z } from "zod";

export const createInterestSchema = z.object({
  workerProfileId: z.string().uuid("Worker profile ID must be a valid UUID"),
  message: z
    .string()
    .max(500, "Message must be 500 characters or less")
    .optional(),
  /** Optional published opening owned by the authenticated recruiter. */
  openingId: z.string().uuid("Opening ID must be a valid UUID").optional().nullable(),
});

export type CreateInterestInput = z.infer<typeof createInterestSchema>;

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: z.ZodIssue[];
}

export function validateCreateInterest(
  input: unknown
): ValidationResult<CreateInterestInput> {
  const result = createInterestSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error.issues };
}

export type UserRole = "worker" | "recruiter";

export interface AuthorizationResult {
  authorized: boolean;
  reason?: "unauthenticated" | "wrong_role" | "forbidden";
}

export function canExpressInterest(
  userId: string | null | undefined,
  userRole: UserRole | null | undefined
): AuthorizationResult {
  if (!userId) {
    return { authorized: false, reason: "unauthenticated" };
  }

  if (userRole !== "recruiter") {
    return { authorized: false, reason: "wrong_role" };
  }

  return { authorized: true };
}

export function canViewInterests(
  userId: string | null | undefined,
  userRole: UserRole | null | undefined
): AuthorizationResult {
  if (!userId) {
    return { authorized: false, reason: "unauthenticated" };
  }

  if (userRole !== "worker" && userRole !== "recruiter") {
    return { authorized: false, reason: "forbidden" };
  }

  return { authorized: true };
}

export function validateUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function sanitizeMessage(message: string | undefined): string | null {
  if (!message) {
    return null;
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.slice(0, 500);
}
