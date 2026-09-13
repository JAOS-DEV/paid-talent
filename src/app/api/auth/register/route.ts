import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createUserWithRole } from "@/lib/auth";
import { db, users, workerProfiles, recruiterProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types/auth";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  role: z.enum(["worker", "recruiter"]),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function validateAndCreateUser(
  email: string,
  role: UserRole,
  dob: string
): Promise<{ success: true; userId: string; isNewUser: boolean } | { success: false; error: string; status: number }> {
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
    return { success: false, error: "Must be 18 or older", status: 403 };
  }

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    return { success: true, userId: existingUser.id, isNewUser: false };
  }

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

  return { success: true, userId: newUser.id, isNewUser: true };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { email, role, dob } = validation.data;
    const result = await validateAndCreateUser(email, role, dob);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      userId: result.userId,
      isNewUser: result.isNewUser,
    });
  } catch (error) {
    console.error("[Register] Error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const role = searchParams.get("role") as UserRole;
  const dob = searchParams.get("dob");
  const email = searchParams.get("email");

  if (!role || !["worker", "recruiter"].includes(role)) {
    return NextResponse.redirect(new URL("/auth/role-select", request.url));
  }

  if (!dob) {
    return NextResponse.redirect(
      new URL(`/auth/age-verification?role=${role}`, request.url)
    );
  }

  if (email) {
    const result = await validateAndCreateUser(email, role, dob);
    if (!result.success) {
      return NextResponse.redirect(
        new URL("/auth/error?error=AccessDenied", request.url)
      );
    }
  }

  const redirectUrl =
    role === "worker" ? "/worker/onboarding" : "/recruiter/dashboard";
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
