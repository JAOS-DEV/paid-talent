import { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types/auth";
import { isOver18 } from "@/lib/helpers/age-verification";

/**
 * SECURITY: Determines if the development-only email bypass is allowed.
 *
 * The Credentials provider with email-only sign-in is a DEVELOPMENT CONVENIENCE ONLY.
 * It allows seeded test accounts to sign in without OAuth or magic links.
 *
 * This bypass is ONLY enabled when ALL conditions are met:
 * 1. NODE_ENV === 'development'
 * 2. AUTH_DEV_BYPASS === 'true' (explicit opt-in)
 *
 * NEVER enable this in production. The bypass allows account takeover if enabled
 * in any environment where untrusted users can access the application.
 */
export function isDevBypassAllowed(): boolean {
  const isDevelopment = process.env.NODE_ENV === "development";
  const hasExplicitBypass = process.env.AUTH_DEV_BYPASS === "true";

  return isDevelopment && hasExplicitBypass;
}

/**
 * Check if Email (magic link) provider is properly configured.
 * Requires EMAIL_SERVER environment variable to be set.
 */
export function isEmailProviderConfigured(): boolean {
  return !!process.env.EMAIL_SERVER && !!process.env.EMAIL_FROM;
}

/**
 * Build the list of authentication providers based on environment configuration.
 */
function buildProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ];

  // Add Email (magic link) provider if configured
  // This is the SECURE way to authenticate via email - sends a link, session only after click
  if (isEmailProviderConfigured()) {
    providers.push(
      Nodemailer({
        id: "email",
        name: "Email",
        server: process.env.EMAIL_SERVER!,
        from: process.env.EMAIL_FROM!,
      })
    );
  }

  // Add Credentials provider for dev bypass ONLY
  // This is INSECURE and only for local development with seeded test accounts
  if (isDevBypassAllowed()) {
    providers.push(
      Credentials({
        id: "credentials",
        name: "Dev Bypass",
        credentials: {
          email: { label: "Email", type: "email" },
        },
        async authorize(credentials) {
          if (!credentials?.email) return null;

          // Double-check bypass is allowed (defense in depth)
          if (!isDevBypassAllowed()) {
            console.warn("[AUTH SECURITY] Credentials authorize called but bypass not allowed");
            return null;
          }

          const email = credentials.email as string;
          const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (existingUser) {
            return {
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
              image: existingUser.image,
              role: existingUser.role,
              ageVerified: existingUser.ageVerified,
            };
          }

          return null;
        },
      })
    );
  }

  return providers;
}

export const authConfig: NextAuthConfig = {
  providers: buildProviders(),
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
    newUser: "/onboarding",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Handle OAuth providers (Google)
      if (account?.provider === "google") {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email!))
          .limit(1);

        if (!existingUser) {
          return "/auth/role-select?email=" + encodeURIComponent(user.email!);
        }

        if (!existingUser.ageVerified) {
          return "/auth/age-verification";
        }
      }

      // Handle Email magic link provider
      if (account?.provider === "email") {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email!))
          .limit(1);

        if (!existingUser) {
          // New user via magic link - redirect to role selection
          return "/auth/role-select?email=" + encodeURIComponent(user.email!);
        }

        if (!existingUser.ageVerified) {
          return "/auth/age-verification?email=" + encodeURIComponent(user.email!);
        }
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: UserRole }).role;
        token.ageVerified = (user as { ageVerified: boolean }).ageVerified;
      }

      if (trigger === "update" && session) {
        token.role = (session as { role?: UserRole }).role ?? token.role;
        token.ageVerified = (session as { ageVerified?: boolean }).ageVerified ?? token.ageVerified;
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.ageVerified = token.ageVerified as boolean;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
};

export async function createUserWithRole(
  email: string,
  role: UserRole,
  dateOfBirth: Date | null,
  name?: string
): Promise<typeof users.$inferSelect> {
  const now = new Date();
  const ageVerified = dateOfBirth ? isOver18(dateOfBirth) : false;

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      role,
      name: name ?? null,
      dateOfBirth: dateOfBirth?.toISOString().split("T")[0] ?? null,
      ageVerified,
      ageVerifiedAt: ageVerified ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return newUser;
}

export { isOver18 };
