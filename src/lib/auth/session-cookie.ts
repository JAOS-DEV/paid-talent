import { encode } from "next-auth/jwt";
import type { UserRole } from "@/types/auth";

export const AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface AuthSessionCookiePayload {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: UserRole;
  ageVerified: boolean;
}

export interface SessionCookieWriter {
  set(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      sameSite: "lax";
      secure: boolean;
      path: "/";
      maxAge: number;
    }
  ): void;
  get(name: string): { value: string } | undefined;
}

export function getAuthSessionCookieName(secure: boolean): string {
  return `${secure ? "__Secure-" : ""}authjs.session-token`;
}

export function resolveAuthSessionCookieTarget(input: {
  cookieStore: SessionCookieWriter;
  requestUrl?: string | null;
  authUrl?: string | null;
  nodeEnv?: string | null;
}): { name: string; secure: boolean } {
  const secureName = getAuthSessionCookieName(true);
  const plainName = getAuthSessionCookieName(false);

  if (input.cookieStore.get(secureName)?.value) {
    return { name: secureName, secure: true };
  }
  if (input.cookieStore.get(plainName)?.value) {
    return { name: plainName, secure: false };
  }

  const authUrl = input.authUrl ?? "";
  if (authUrl.startsWith("https://")) {
    return { name: secureName, secure: true };
  }
  if (authUrl.startsWith("http://")) {
    return { name: plainName, secure: false };
  }

  if (input.requestUrl?.startsWith("https://")) {
    return { name: secureName, secure: true };
  }

  return {
    name: getAuthSessionCookieName(input.nodeEnv === "production"),
    secure: input.nodeEnv === "production",
  };
}

export async function encodeAuthSessionToken(
  payload: AuthSessionCookiePayload,
  salt: string,
  secret: string,
  maxAge = AUTH_SESSION_MAX_AGE_SECONDS
): Promise<string> {
  return encode({
    token: {
      sub: payload.id,
      id: payload.id,
      email: payload.email,
      name: payload.name ?? null,
      picture: payload.image ?? null,
      role: payload.role,
      ageVerified: payload.ageVerified,
      signupPending: false,
    },
    secret,
    salt,
    maxAge,
  });
}

export async function encodePendingSignupToken(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  salt: string;
  secret: string;
  nowMs?: number;
  maxAgeSeconds?: number;
}): Promise<string> {
  const maxAge = input.maxAgeSeconds ?? 15 * 60;
  const nowMs = input.nowMs ?? Date.now();
  return encode({
    token: {
      email: input.email,
      name: input.name ?? null,
      picture: input.image ?? null,
      signupPending: true,
      signupPendingExpiresAt: nowMs + maxAge * 1000,
      ageVerified: false,
    },
    secret: input.secret,
    salt: input.salt,
    maxAge,
  });
}

export async function writeFullAuthSessionCookie(input: {
  cookieStore: SessionCookieWriter;
  payload: AuthSessionCookiePayload;
  secret: string;
  requestUrl?: string | null;
  authUrl?: string | null;
  nodeEnv?: string | null;
}): Promise<{ name: string }> {
  const target = resolveAuthSessionCookieTarget(input);
  const value = await encodeAuthSessionToken(
    input.payload,
    target.name,
    input.secret
  );

  input.cookieStore.set(target.name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: target.secure,
    path: "/",
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  });

  return { name: target.name };
}
