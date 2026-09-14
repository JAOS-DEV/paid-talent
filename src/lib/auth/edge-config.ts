import { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import type { UserRole } from "@/types/auth";
import { applyJwtSessionUpdate } from "@/lib/auth/sign-in-decision";

/**
 * Edge-safe NextAuth config for middleware.
 *
 * MUST NOT import database, postgres, nodemailer, next/headers cookies,
 * or any other Node-only module. Vercel middleware runs on the Edge
 * runtime; those imports cause MIDDLEWARE_INVOCATION_FAILED.
 */
export const authPages = {
  signIn: "/auth/signin",
  verifyRequest: "/auth/verify-request",
  error: "/auth/error",
  newUser: "/onboarding",
} as const;

export const jwtCallback: NonNullable<NextAuthConfig["callbacks"]>["jwt"] =
  async ({ token, user, trigger, session }) => {
    if (user) {
      token.id = user.id as string;
      token.role = (user as { role: UserRole }).role;
      token.ageVerified = (user as { ageVerified: boolean }).ageVerified;
    }

    if (trigger === "update" && session) {
      const updated = applyJwtSessionUpdate({
        tokenRole: token.role as UserRole | undefined,
        tokenAgeVerified: token.ageVerified as boolean | undefined,
        sessionRole: (session as { role?: UserRole }).role,
        sessionAgeVerified: (session as { ageVerified?: boolean })
          .ageVerified,
      });
      token.role = updated.role;
      token.ageVerified = updated.ageVerified;
    }

    return token;
  };

export const sessionCallback: NonNullable<
  NextAuthConfig["callbacks"]
>["session"] = async ({ session, token }) => {
  if (token) {
    session.user.id = token.id as string;
    session.user.role = token.role as UserRole;
    session.user.ageVerified = token.ageVerified as boolean;
  }
  return session;
};

export const edgeAuthConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: authPages,
  callbacks: {
    jwt: jwtCallback,
    session: sessionCallback,
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
};
