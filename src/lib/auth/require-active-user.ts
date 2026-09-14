import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserAccountAccess } from "@/lib/auth/account-access";
import type { AccountRestrictionReason } from "@/lib/auth/account-restriction";
import type { UserRole } from "@/types/auth";

export interface ActiveAppUser {
  userId: string;
  email: string | null;
  role: UserRole;
  ageVerified: boolean;
}

export type RequireActiveUserFailure = {
  ok: false;
  status: 401 | 403;
  error: string;
  reason: "unauthenticated" | "forbidden_role" | AccountRestrictionReason;
};

export type RequireActiveUserResult =
  | { ok: true; user: ActiveAppUser }
  | RequireActiveUserFailure;

function isUserRole(value: unknown): value is UserRole {
  return value === "worker" || value === "recruiter";
}

export async function requireActiveAppUser(input?: {
  role?: UserRole | UserRole[];
}): Promise<RequireActiveUserResult> {
  const session = await auth();
  const userId = session?.user?.id;
  const sessionRole = session?.user?.role;

  if (!userId || session?.user?.signupPending === true) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      reason: "unauthenticated",
    };
  }

  if (!isUserRole(sessionRole)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      reason: "forbidden_role",
    };
  }

  const allowedRoles = input?.role
    ? Array.isArray(input.role)
      ? input.role
      : [input.role]
    : null;

  if (allowedRoles && !allowedRoles.includes(sessionRole)) {
    return {
      ok: false,
      status: 403,
      error:
        allowedRoles.length === 1 && allowedRoles[0] === "worker"
          ? "Not a worker"
          : allowedRoles.length === 1 && allowedRoles[0] === "recruiter"
            ? "Not a recruiter"
            : "Forbidden",
      reason: "forbidden_role",
    };
  }

  const access = await getUserAccountAccess(userId);
  if (!access.allowed) {
    return {
      ok: false,
      status: 403,
      error: "Account restricted",
      reason: access.reason ?? "banned",
    };
  }

  return {
    ok: true,
    user: {
      userId,
      email: access.email ?? session.user.email ?? null,
      role: sessionRole,
      ageVerified: session.user.ageVerified === true,
    },
  };
}

export async function requireActiveWorker(): Promise<RequireActiveUserResult> {
  return requireActiveAppUser({ role: "worker" });
}

export async function requireActiveRecruiter(): Promise<RequireActiveUserResult> {
  return requireActiveAppUser({ role: "recruiter" });
}

export function deniedActiveUserResponse(
  result: RequireActiveUserFailure
): NextResponse {
  return NextResponse.json(
    { error: result.error, reason: result.reason },
    { status: result.status }
  );
}

export function actionAuthError(
  result: RequireActiveUserFailure
): { ok: false; error: string } {
  return { ok: false, error: result.error };
}
