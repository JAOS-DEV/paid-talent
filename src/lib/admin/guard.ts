import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export type AdminPageAccess =
  | { status: "redirect_signin"; callbackUrl: string }
  | { status: "not_found" }
  | { status: "authorized"; email: string };

/**
 * Pure access decision for /admin pages.
 * Never exposes ADMIN_EMAILS contents — only yes/no via isAdminEmail.
 */
export function resolveAdminPageAccess(input: {
  isAuthenticated: boolean;
  email: string | null | undefined;
  pathname: string;
}): AdminPageAccess {
  if (!input.isAuthenticated) {
    return {
      status: "redirect_signin",
      callbackUrl: input.pathname || "/admin",
    };
  }

  const check = isAdminEmail(input.email);
  if (!check.isAdmin || !check.email) {
    return { status: "not_found" };
  }

  return { status: "authorized", email: check.email };
}

/**
 * Server-side page guard for /admin/* routes.
 * Unauthenticated → sign-in with callbackUrl.
 * Authenticated non-admin → notFound() (do not leak allowlist).
 */
export async function requireAdminPage(pathname: string): Promise<{
  email: string;
}> {
  const session = await auth();
  const access = resolveAdminPageAccess({
    isAuthenticated: !!session?.user,
    email: session?.user?.email,
    pathname,
  });

  if (access.status === "redirect_signin") {
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(access.callbackUrl)}`
    );
  }

  if (access.status === "not_found") {
    notFound();
  }

  return { email: access.email };
}
