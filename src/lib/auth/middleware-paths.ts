import type { UserRole } from "@/types/auth";

/**
 * Middleware matcher and role-routing helpers.
 * Kept free of NextRequest / DB so callback-route exclusions are unit-testable.
 */

export const MIDDLEWARE_MATCHER = [
  "/((?!_next/static|_next/image|favicon.ico|api/auth|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
] as const;

const MIDDLEWARE_MATCHER_RE =
  /^\/((?!_next\/static|_next\/image|favicon\.ico|api\/auth|public|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)/;

export const WORKER_ONLY_PREFIXES = ["/worker"] as const;
export const RECRUITER_ONLY_PREFIXES = ["/recruiter", "/search"] as const;

export function isAuthApiPath(pathname: string): boolean {
  return pathname === "/api/auth" || pathname.startsWith("/api/auth/");
}

export function middlewareMatcherHits(pathname: string): boolean {
  return MIDDLEWARE_MATCHER_RE.test(pathname);
}

function matchesPrefix(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * Role-based Worker/Recruiter routing after the auth/age gate.
 * Returns a redirect destination or null when the role may proceed.
 */
export function resolveRoleRouteRedirect(
  pathname: string,
  role: string | undefined
): string | null {
  const isWorkerRoute = WORKER_ONLY_PREFIXES.some((route) =>
    matchesPrefix(pathname, route)
  );
  const isRecruiterRoute = RECRUITER_ONLY_PREFIXES.some((route) =>
    matchesPrefix(pathname, route)
  );

  if (isWorkerRoute && role !== "worker") {
    return "/recruiter/dashboard";
  }

  if (isRecruiterRoute && role !== "recruiter") {
    return "/worker/dashboard";
  }

  return null;
}

/**
 * JWT-only home destination used by Edge middleware (no DB / completeness).
 * Worker dashboard already sends incomplete profiles to onboarding.
 */
export function getSessionHomePath(role: UserRole): string {
  return role === "recruiter" ? "/recruiter/dashboard" : "/worker/dashboard";
}
