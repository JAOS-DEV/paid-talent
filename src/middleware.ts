import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getProfileCompleteness } from "@/lib/profile";
import { getHomeRedirectDestination } from "@/lib/helpers/home-redirect";
import { resolveMiddlewareGate } from "@/lib/auth/middleware-gate";

const workerOnlyRoutes = ["/worker"];
const recruiterOnlyRoutes = ["/recruiter", "/search"];

async function getWorkerProfileCompleteness(
  userId: string
): Promise<ReturnType<typeof getProfileCompleteness>> {
  const [profile] = await db
    .select()
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, userId))
    .limit(1);

  return getProfileCompleteness(profile || null);
}

export default async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const session = await auth();

  const isApiRoute = pathname.startsWith("/api/");
  const isAuthApiRoute = pathname.startsWith("/api/auth");
  const user = session?.user as
    | { ageVerified?: boolean; role?: string; id?: string }
    | undefined;

  const gate = resolveMiddlewareGate({
    pathname,
    hasSession: !!session?.user,
    ageVerified: !!user?.ageVerified,
    isApiRoute,
    isAuthApiRoute,
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

  // Auth API and unauthenticated public routes are done after allow
  if (isAuthApiRoute || !session?.user || !user) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    let profileCompleteness = null;

    if (user.role === "worker" && user.id) {
      profileCompleteness = await getWorkerProfileCompleteness(user.id);
    }

    const redirectResult = getHomeRedirectDestination({
      isAuthenticated: true,
      role: (user.role as "worker" | "recruiter") || null,
      profileCompleteness,
    });

    if (redirectResult.shouldRedirect && redirectResult.destination) {
      return NextResponse.redirect(new URL(redirectResult.destination, req.url));
    }
  }

  const isWorkerRoute = workerOnlyRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  const isRecruiterRoute = recruiterOnlyRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isWorkerRoute && user.role !== "worker") {
    return NextResponse.redirect(new URL("/recruiter/dashboard", req.url));
  }

  if (isRecruiterRoute && user.role !== "recruiter") {
    return NextResponse.redirect(new URL("/worker/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
