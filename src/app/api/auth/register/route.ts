import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createUserWithRole } from "@/lib/auth";
import { db, users, workerProfiles, recruiterProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const role = searchParams.get("role") as UserRole;
  const dob = searchParams.get("dob");
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const email = searchParams.get("email");

  if (!role || !["worker", "recruiter"].includes(role)) {
    return NextResponse.redirect(new URL("/auth/role-select", request.url));
  }

  if (!dob) {
    return NextResponse.redirect(
      new URL(`/auth/age-verification?role=${role}`, request.url)
    );
  }

  const dateOfBirth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age--;
  }

  if (age < 18) {
    return NextResponse.redirect(
      new URL("/auth/error?error=AccessDenied", request.url)
    );
  }

  if (email) {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existingUser) {
      const newUser = await createUserWithRole(email, role, dateOfBirth);

      if (role === "worker") {
        await db.insert(workerProfiles).values({
          userId: newUser.id,
          displayName: newUser.name || email.split("@")[0],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        await db.insert(recruiterProfiles).values({
          userId: newUser.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  const redirectUrl =
    role === "worker" ? "/worker/dashboard" : "/recruiter/dashboard";
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
