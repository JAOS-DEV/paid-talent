import { isAdminEmail } from "@/lib/admin";

export const PRIVATE_MEDIA_FORBIDDEN = "PRIVATE_MEDIA_FORBIDDEN";

export class PrivateMediaAccessError extends Error {
  readonly code: typeof PRIVATE_MEDIA_FORBIDDEN = PRIVATE_MEDIA_FORBIDDEN;

  constructor(message = "Not allowed to access private verification media") {
    super(message);
    this.name = "PrivateMediaAccessError";
  }
}

export type PrivateVerificationReadDenial =
  | "unauthenticated"
  | "not_admin"
  | "worker"
  | "recruiter";

export type PrivateVerificationReadAccess =
  | { allowed: true; email: string }
  | { allowed: false; reason: PrivateVerificationReadDenial };

export function resolvePrivateVerificationReadAccess(input: {
  isAuthenticated: boolean;
  email?: string | null;
  role?: string | null;
}): PrivateVerificationReadAccess {
  if (!input.isAuthenticated) {
    return { allowed: false, reason: "unauthenticated" };
  }

  const adminCheck = isAdminEmail(input.email);
  if (adminCheck.isAdmin && adminCheck.email) {
    return { allowed: true, email: adminCheck.email };
  }

  if (input.role === "worker") {
    return { allowed: false, reason: "worker" };
  }

  if (input.role === "recruiter") {
    return { allowed: false, reason: "recruiter" };
  }

  return { allowed: false, reason: "not_admin" };
}

export function assertAdminCanAccessPrivateVerificationMedia(
  email: string | null | undefined
): string {
  const access = resolvePrivateVerificationReadAccess({
    isAuthenticated: true,
    email,
  });

  if (!access.allowed) {
    throw new PrivateMediaAccessError();
  }

  return access.email;
}
