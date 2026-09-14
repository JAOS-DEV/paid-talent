import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { completeAgeVerification } from "@/lib/auth/complete-age-verification";
import { writeFullAuthSessionCookie } from "@/lib/auth/session-cookie";
import {
  SIGNUP_INTENT_COOKIE,
  consumeSignupIntentCookie,
  parseSignupIntentRole,
} from "@/lib/auth/signup-intent";
import { z } from "zod";

const verifyAgeSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    const body = await request.json();
    const validation = verifyAgeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid date of birth format" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const result = await completeAgeVerification({
      session: session?.user
        ? {
            signupPending: session.user.signupPending === true,
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            image: session.user.image,
            role: session.user.role,
          }
        : null,
      dateOfBirth: validation.data.dateOfBirth,
      signupIntentRole: parseSignupIntentRole(
        cookieStore.get(SIGNUP_INTENT_COOKIE)?.value
      ),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Failed to verify age" },
        { status: 500 }
      );
    }

    await writeFullAuthSessionCookie({
      cookieStore,
      payload: {
        id: result.userId,
        email: result.email,
        name: result.name,
        image: result.image,
        role: result.role,
        ageVerified: true,
      },
      secret,
      requestUrl: request.url,
      authUrl: process.env.AUTH_URL ?? process.env.NEXTAUTH_URL,
      nodeEnv: process.env.NODE_ENV,
    });

    if (result.promotedFromPending) {
      consumeSignupIntentCookie(
        cookieStore,
        process.env.NODE_ENV === "production"
      );
    }

    return NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
    });
  } catch (error) {
    console.error("[VerifyAge] Error:", error);
    return NextResponse.json(
      { error: "Failed to verify age" },
      { status: 500 }
    );
  }
}
