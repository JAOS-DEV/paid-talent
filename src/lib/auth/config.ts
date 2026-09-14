import { type NextAuthConfig } from "next-auth";
import type { Provider } from "@auth/core/providers";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users, workerProfiles, recruiterProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types/auth";
import { isOver18 } from "@/lib/helpers/age-verification";
import { resolveProviderSignInDecision } from "@/lib/auth/sign-in-decision";
import {
  authPages,
  jwtCallback,
  sessionCallback,
} from "@/lib/auth/edge-config";

let cachedNodemailer: Provider | null = null;

function getNodemailerProvider(): Provider | null {
  if (!isEmailProviderConfigured()) return null;
  
  if (cachedNodemailer) return cachedNodemailer;
  
  try {
    // Dynamic require to avoid loading nodemailer in edge runtime
    // Nodemailer uses Node.js 'stream' module which isn't available in edge
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Nodemailer = require("next-auth/providers/nodemailer").default;
    cachedNodemailer = Nodemailer({
      id: "email",
      name: "Email",
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
    });
    return cachedNodemailer;
  } catch {
    // In edge runtime, nodemailer will fail to load - that's expected
    // The email provider just won't be available in edge context
    return null;
  }
}

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
  // Uses dynamic require to avoid loading nodemailer in edge runtime (middleware)
  const nodemailerProvider = getNodemailerProvider();
  if (nodemailerProvider) {
    providers.push(nodemailerProvider);
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
  pages: authPages,
  callbacks: {
    async signIn({ user, account }) {
      const cookieStore = await cookies();
      const signupIntentRole = cookieStore.get("signup_intent_role")?.value as
        | UserRole
        | undefined;

      const provider = account?.provider;
      if (provider !== "google" && provider !== "email") {
        return true;
      }

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email!))
        .limit(1);

      const decision = resolveProviderSignInDecision({
        existingUser: existingUser
          ? {
              id: existingUser.id,
              role: existingUser.role as UserRole,
              ageVerified: existingUser.ageVerified,
            }
          : null,
        signupIntentRole,
        email: user.email!,
      });

      if (decision.kind === "abort_redirect") {
        return decision.url;
      }

      if (decision.kind === "complete_existing") {
        user.id = decision.user.id;
        (user as { role: UserRole }).role = decision.user.role;
        (user as { ageVerified: boolean }).ageVerified =
          decision.user.ageVerified;
        // Complete sign-in; middleware redirects if ageVerified=false
        return true;
      }

      // create_and_complete — new user with valid signup_intent_role
      const role = decision.role;
      const now = new Date();
      const [newUser] = await db
        .insert(users)
        .values({
          email: user.email!,
          name: user.name ?? null,
          image: provider === "google" ? (user.image ?? null) : null,
          role,
          ageVerified: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (role === "worker") {
        await db.insert(workerProfiles).values({
          userId: newUser.id,
          displayName: user.name || user.email!.split("@")[0],
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await db.insert(recruiterProfiles).values({
          userId: newUser.id,
          createdAt: now,
          updatedAt: now,
        });
      }

      user.id = newUser.id;
      (user as { role: UserRole }).role = role;
      (user as { ageVerified: boolean }).ageVerified = false;

      // Complete sign-in; middleware redirects to age-verification
      return true;
    },
    jwt: jwtCallback,
    session: sessionCallback,
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
