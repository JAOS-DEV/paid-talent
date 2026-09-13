import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isOver18 } from "@/lib/helpers/age-verification";
import { getPostAgeVerificationRedirect } from "@/lib/auth/sign-in-decision";
import { z } from "zod";

const verifyAgeSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = verifyAgeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid date of birth format" },
        { status: 400 }
      );
    }

    const { dateOfBirth } = validation.data;
    const dob = new Date(dateOfBirth);

    if (!isOver18(dob)) {
      return NextResponse.json(
        { error: "Paid Talent is for adults 20+. You can't create an account under 20." },
        { status: 403 }
      );
    }

    const now = new Date();

    await db
      .update(users)
      .set({
        dateOfBirth: dateOfBirth,
        ageVerified: true,
        ageVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, session.user.id));

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const redirectUrl = getPostAgeVerificationRedirect(user?.role);

    return NextResponse.json({
      success: true,
      redirectUrl,
    });
  } catch (error) {
    console.error("[VerifyAge] Error:", error);
    return NextResponse.json(
      { error: "Failed to verify age" },
      { status: 500 }
    );
  }
}
