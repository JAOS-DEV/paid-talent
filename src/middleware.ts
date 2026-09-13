import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getProfileCompleteness } from "@/lib/profile";
import { getHomeRedirectDestination } from "@/lib/helpers/home-redirect";

const publicRoutes = [
  "/",
  "/auth/signin",
  "/auth/role-select",
  "/auth/age-verification",
  "/auth/verify-request",
  "/auth/error",
  "/api/auth",
];

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

  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  const isApiRoute = pathname.startsWith("/api/");
  const isAuthRoute = pathname.startsWith("/api/auth");

  if (isAuthRoute) {
    return NextResponse.next();
  }

  if (!session?.user) {
    if (isPublicRoute) {
      return NextResponse.next();
    }

    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const user = session.user as { ageVerified?: boolean; role?: string; id?: string };

  if (!user.ageVerified) {
    if (pathname === "/auth/age-verification") {
      return NextResponse.next();
    }

    if (isApiRoute) {
      return NextResponse.json(
        { error: "Age verification required" },
        { status: 403 }
      );
    }

    return NextResponse.redirect(new URL("/auth/age-verification", req.url));
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
