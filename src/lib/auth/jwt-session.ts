import type { UserRole } from "@/types/auth";
import {
  getPendingSignupExpiry,
  isActivePendingSignup,
  isAppUserId,
} from "@/lib/auth/pending-signup";

function isAppRole(role: unknown): role is UserRole {
  return role === "worker" || role === "recruiter";
}

export interface AuthJwtToken {
  id?: string;
  sub?: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  role?: UserRole;
  ageVerified?: boolean;
  signupPending?: boolean;
  signupPendingExpiresAt?: number;
  [key: string]: unknown;
}

export interface AuthJwtUser {
  id?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: UserRole;
  ageVerified?: boolean;
  signupPending?: boolean;
}

/**
 * Client session.update() may only flip ageVerified on an already-created
 * app user. Role, email, id, and pending-signup promotion are never taken
 * from the browser.
 */
export function applyJwtSessionUpdate(input: {
  tokenRole: UserRole | undefined;
  tokenAgeVerified: boolean | undefined;
  sessionAgeVerified?: boolean;
  signupPending?: boolean;
}): { role: UserRole | undefined; ageVerified: boolean | undefined } {
  if (input.signupPending) {
    return { role: undefined, ageVerified: false };
  }

  const role = isAppRole(input.tokenRole) ? input.tokenRole : undefined;

  return {
    role,
    ageVerified: input.sessionAgeVerified ?? input.tokenAgeVerified,
  };
}

export function applyJwtCallback(input: {
  token: AuthJwtToken;
  user?: AuthJwtUser;
  trigger?: string;
  session?: { ageVerified?: boolean; role?: unknown; email?: unknown };
  nowMs?: number;
}): AuthJwtToken {
  const nowMs = input.nowMs ?? Date.now();
  let token: AuthJwtToken = { ...input.token };

  if (input.user) {
    if (input.user.signupPending) {
      return {
        email: input.user.email ?? token.email,
        name: input.user.name ?? token.name,
        picture: input.user.image ?? token.picture,
        signupPending: true,
        signupPendingExpiresAt: getPendingSignupExpiry(nowMs),
        ageVerified: false,
      };
    }

    const role = isAppRole(input.user.role) ? input.user.role : undefined;
    const id = isAppUserId(input.user.id) ? input.user.id : undefined;

    token = {
      ...token,
      id,
      sub: id,
      email: input.user.email ?? token.email,
      name: input.user.name ?? token.name,
      picture: input.user.image ?? token.picture,
      role,
      ageVerified: input.user.ageVerified === true,
      signupPending: false,
    };
    delete token.signupPendingExpiresAt;
    return token;
  }

  if (token.signupPending) {
    if (
      !isActivePendingSignup({
        signupPending: true,
        signupPendingExpiresAt: token.signupPendingExpiresAt,
        nowMs,
      })
    ) {
      return {};
    }

    if (input.trigger === "update") {
      return token;
    }

    return {
      ...token,
      id: undefined,
      role: undefined,
      ageVerified: false,
      signupPending: true,
    };
  }

  if (input.trigger === "update" && input.session) {
    const updated = applyJwtSessionUpdate({
      tokenRole: token.role,
      tokenAgeVerified: token.ageVerified,
      sessionAgeVerified:
        typeof input.session.ageVerified === "boolean"
          ? input.session.ageVerified
          : undefined,
      signupPending: false,
    });
    token.role = updated.role;
    token.ageVerified = updated.ageVerified;
  }

  return token;
}

export function toPublicSessionUser(token: AuthJwtToken): {
  id: string;
  role: UserRole | undefined;
  ageVerified: boolean;
  signupPending: boolean;
  email: string | null | undefined;
  name: string | null | undefined;
  image: string | null | undefined;
} {
  if (token.signupPending) {
    if (
      !isActivePendingSignup({
        signupPending: true,
        signupPendingExpiresAt: token.signupPendingExpiresAt,
      })
    ) {
      return {
        id: "",
        role: undefined,
        ageVerified: false,
        signupPending: false,
        email: null,
        name: null,
        image: null,
      };
    }

    return {
      id: "",
      role: undefined,
      ageVerified: false,
      signupPending: true,
      email: token.email,
      name: token.name,
      image: token.picture,
    };
  }

  return {
    id: isAppUserId(token.id) ? token.id : "",
    role: isAppRole(token.role) ? token.role : undefined,
    ageVerified: token.ageVerified === true,
    signupPending: false,
    email: token.email,
    name: token.name,
    image: token.picture,
  };
}
