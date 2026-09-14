import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createUserWithRole } from "@/lib/auth/create-account";
import { isAppUserId } from "@/lib/auth/pending-signup";
import {
  getPostAgeVerificationRedirect,
  isValidSignupIntentRole,
} from "@/lib/auth/sign-in-decision";
import { meetsMinimumAge } from "@/lib/helpers/age-verification";
import { findActiveBannedIdentity } from "@/lib/auth/banned-identities";
import type { UserRole } from "@/types/auth";

export interface AgeVerificationSession {
  signupPending?: boolean;
  id?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: UserRole;
}

export type AgeVerificationResult =
  | {
      ok: true;
      userId: string;
      role: UserRole;
      email: string;
      name: string | null;
      image: string | null;
      redirectUrl: string;
      promotedFromPending: boolean;
    }
  | { ok: false; status: number; error: string };

function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  return undefined;
}

export async function completeAgeVerification(input: {
  session: AgeVerificationSession | null;
  dateOfBirth: string;
  signupIntentRole: string | undefined;
  requestedEmail?: string;
  requestedRole?: string;
  now?: Date;
}): Promise<AgeVerificationResult> {
  const session = input.session;
  if (!session) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const dob = new Date(input.dateOfBirth);
  if (!meetsMinimumAge(dob, input.now)) {
    return {
      ok: false,
      status: 403,
      error: "Paid Talent is for adults 20+. You can't create an account under 20.",
    };
  }

  const now = input.now ?? new Date();

  if (session.signupPending) {
    const email = session.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }

    const activeBan = await findActiveBannedIdentity(email);
    if (activeBan) {
      return {
        ok: false,
        status: 403,
        error: "This verified identity is banned from Paid Talent.",
      };
    }

    if (
      input.requestedEmail &&
      input.requestedEmail.trim().toLowerCase() !== email
    ) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }

    const role = isValidSignupIntentRole(input.signupIntentRole)
      ? input.signupIntentRole
      : undefined;
    if (!role) {
      return {
        ok: false,
        status: 400,
        error: "Choose a role and confirm you're 20+ to finish creating your account.",
      };
    }

    if (input.requestedRole && input.requestedRole !== role) {
      return {
        ok: false,
        status: 400,
        error: "Choose a role and confirm you're 20+ to finish creating your account.",
      };
    }

    const [existing] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return {
        ok: false,
        status: 409,
        error: "An account already exists for this Google identity. Sign in instead.",
      };
    }

    try {
      const created = await createUserWithRole({
        email,
        name: session.name ?? null,
        image: session.image ?? null,
        role,
        ageVerified: true,
        dateOfBirth: input.dateOfBirth,
        ageVerifiedAt: now,
        now,
      });

      return {
        ok: true,
        userId: created.id,
        role: created.role,
        email: created.email,
        name: created.name,
        image: created.image,
        redirectUrl: getPostAgeVerificationRedirect(created.role),
        promotedFromPending: true,
      };
    } catch (error) {
      if (postgresErrorCode(error) === "23505") {
        return {
          ok: false,
          status: 409,
          error: "An account already exists for this Google identity. Sign in instead.",
        };
      }
      throw error;
    }
  }

  if (!isAppUserId(session.id)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  await db
    .update(users)
    .set({
      dateOfBirth: input.dateOfBirth,
      ageVerified: true,
      ageVerifiedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, session.id));

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);

  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const role = isValidSignupIntentRole(user.role) ? user.role : "worker";

  return {
    ok: true,
    userId: user.id,
    role,
    email: user.email,
    name: user.name,
    image: user.image,
    redirectUrl: getPostAgeVerificationRedirect(role),
    promotedFromPending: false,
  };
}
