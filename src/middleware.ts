import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { edgeAuthConfig } from "@/lib/auth/edge-config";
import { resolveMiddlewareGate } from "@/lib/auth/middleware-gate";
import {
  getSessionHomePath,
  isAuthApiPath,
  resolveRoleRouteRedirect,
} from "@/lib/auth/middleware-paths";

const { auth } = NextAuth(edgeAuthConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // NextAuth callback/session routes must never run gate logic or Node/DB code.
  if (isAuthApiPath(pathname)) {
    return NextResponse.next();
  }

  try {
    const session = req.auth;
    const isApiRoute = pathname.startsWith("/api/");
    const user = session?.user as
      | { ageVerified?: boolean; role?: string; id?: string }
      | undefined;

    const gate = resolveMiddlewareGate({
      pathname,
      hasSession: !!session?.user,
      ageVerified: !!user?.ageVerified,
      isApiRoute,
      isAuthApiRoute: false,
    });

    if (gate.action === "json") {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    if (gate.action === "redirect") {
      const url = new URL(gate.destination, req.url);
      if (gate.setCallbackUrl) {
        url.searchParams.set("callbackUrl", pathname);
      }
      return NextResponse.redirect(url);
    }

    if (!session?.user || !user) {
      return NextResponse.next();
    }

    if (pathname === "/" && (user.role === "worker" || user.role === "recruiter")) {
      return NextResponse.redirect(
        new URL(getSessionHomePath(user.role), req.url)
      );
    }

    const roleRedirect = resolveRoleRouteRedirect(pathname, user.role);
    if (roleRedirect) {
      return NextResponse.redirect(new URL(roleRedirect, req.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error("[middleware]", {
      pathname,
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
