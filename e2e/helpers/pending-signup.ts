import { config as loadEnv } from "dotenv";
import type { BrowserContext, Page } from "@playwright/test";
import {
  encodePendingSignupToken,
  getAuthSessionCookieName,
} from "../../src/lib/auth/session-cookie";
import { PENDING_SIGNUP_MAX_AGE_SECONDS } from "../../src/lib/auth/pending-signup";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export function hasPendingSignupSecret(): boolean {
  return Boolean(process.env.AUTH_SECRET);
}

export const PENDING_SIGNUP_SKIP_REASON =
  "Requires AUTH_SECRET to mint a pending Auth.js JWT. Use the local .env.local secret.";

export async function addPendingSignupCookie(
  context: BrowserContext,
  input: { email: string; name?: string; baseURL?: string }
): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(PENDING_SIGNUP_SKIP_REASON);
  }

  const baseURL = input.baseURL ?? "http://localhost:3000";
  const secure = baseURL.startsWith("https://");
  const name = getAuthSessionCookieName(secure);
  const value = await encodePendingSignupToken({
    email: input.email,
    name: input.name ?? "New Google User",
    salt: name,
    secret,
    maxAgeSeconds: PENDING_SIGNUP_MAX_AGE_SECONDS,
  });

  await context.addCookies([
    {
      name,
      value,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      secure,
    },
  ]);
}

export async function countGoogleOAuthStarts(page: Page): Promise<() => number> {
  let googleStarts = 0;
  await page.route("**/api/auth/**", async (route) => {
    if (
      route.request().url().includes("signin/google") ||
      route.request().url().includes("callback/google")
    ) {
      googleStarts += 1;
    }
    await route.continue();
  });
  await page.route("**/accounts.google.com/**", async (route) => {
    googleStarts += 1;
    await route.abort();
  });
  return (): number => googleStarts;
}
