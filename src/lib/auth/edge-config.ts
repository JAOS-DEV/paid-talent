import { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { applyJwtCallback, toPublicSessionUser } from "@/lib/auth/jwt-session";

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
    return applyJwtCallback({
      token,
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: (user as { role?: "worker" | "recruiter" }).role,
            ageVerified: (user as { ageVerified?: boolean }).ageVerified,
            signupPending: (user as { signupPending?: boolean }).signupPending,
          }
        : undefined,
      trigger,
      session: session as
        | { ageVerified?: boolean; role?: unknown; email?: unknown }
        | undefined,
    });
  };

export const sessionCallback: NonNullable<
  NextAuthConfig["callbacks"]
>["session"] = async ({ session, token }) => {
  const publicUser = toPublicSessionUser(token);
  session.user.id = publicUser.id;
  session.user.role = publicUser.role;
  session.user.ageVerified = publicUser.ageVerified;
  session.user.signupPending = publicUser.signupPending;
  if (typeof publicUser.email === "string") {
    session.user.email = publicUser.email;
  }
  if (typeof publicUser.name === "string") {
    session.user.name = publicUser.name;
  }
  if (typeof publicUser.image === "string") {
    session.user.image = publicUser.image;
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
