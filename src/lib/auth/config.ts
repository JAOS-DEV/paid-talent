import { type NextAuthConfig } from "next-auth";
import type { Provider } from "@auth/core/providers";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types/auth";
import { meetsMinimumAge } from "@/lib/helpers/age-verification";
import { resolveProviderSignInDecision } from "@/lib/auth/sign-in-decision";
import { createUserWithRole } from "@/lib/auth/create-account";
import {
  SIGNUP_INTENT_COOKIE,
  consumeSignupIntentCookie,
  parseSignupIntentRole,
  shouldConsumeSignupIntent,
} from "@/lib/auth/signup-intent";
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
      const signupIntentRole = parseSignupIntentRole(
        cookieStore.get(SIGNUP_INTENT_COOKIE)?.value
      );
      const isProduction = process.env.NODE_ENV === "production";

      const consumeIntentSafely = (): void => {
        try {
          consumeSignupIntentCookie(
            {
              set(name, value, options): void {
                cookieStore.set(name, value, options);
              },
            },
            isProduction
          );
        } catch (error) {
          console.error("[AUTH] Failed to consume signup intent cookie", error);
        }
      };

      const provider = account?.provider;
      if (provider !== "google" && provider !== "email") {
        consumeIntentSafely();
        return true;
      }

      if (!user.email) {
        return "/auth/error";
      }

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
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
        email: user.email,
      });

      if (decision.kind === "abort_redirect") {
        return decision.url;
      }

      if (decision.kind === "complete_existing") {
        user.id = decision.user.id;
        user.role = decision.user.role;
        user.ageVerified = decision.user.ageVerified;
        user.signupPending = false;
        if (shouldConsumeSignupIntent(decision.kind)) {
          consumeIntentSafely();
        }
        return true;
      }

      if (decision.kind === "complete_pending_signup") {
        user.signupPending = true;
        user.ageVerified = false;
        user.role = undefined;
        return true;
      }

      const created = await createUserWithRole({
        email: user.email,
        name: user.name ?? null,
        image: provider === "google" ? (user.image ?? null) : null,
        role: decision.role,
        ageVerified: false,
      });

      user.id = created.id;
      user.role = created.role;
      user.ageVerified = false;
      user.signupPending = false;

      if (shouldConsumeSignupIntent(decision.kind)) {
        consumeIntentSafely();
      }

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

export { meetsMinimumAge };
