import { describe, expect, it } from "vitest";
import {
  applyJwtCallback,
  toPublicSessionUser,
} from "../jwt-session";
import {
  PENDING_SIGNUP_MAX_AGE_SECONDS,
  isActivePendingSignup,
  isAppUserId,
} from "../pending-signup";

describe("pending signup JWT", () => {
  const nowMs = Date.now();

  it("completes Google OAuth into a constrained pending token without an app user id or role", () => {
    const token = applyJwtCallback({
      token: { sub: "google-sub-123", email: "new@example.com" },
      user: {
        id: "google-sub-123",
        email: "new@example.com",
        name: "New User",
        image: "https://example.com/a.png",
        signupPending: true,
      },
      nowMs,
    });

    expect(token.signupPending).toBe(true);
    expect(token.email).toBe("new@example.com");
    expect(token.id).toBeUndefined();
    expect(token.role).toBeUndefined();
    expect(token.ageVerified).toBe(false);
    expect(token.signupPendingExpiresAt).toBe(
      nowMs + PENDING_SIGNUP_MAX_AGE_SECONDS * 1000
    );
    expect(isAppUserId(token.sub as string)).toBe(false);
  });

  it("ignores client session.update attempts to spoof role, email, or ageVerified", () => {
    const pending = applyJwtCallback({
      token: {},
      user: {
        email: "new@example.com",
        signupPending: true,
      },
      nowMs,
    });

    const afterSpoof = applyJwtCallback({
      token: pending,
      trigger: "update",
      session: {
        ageVerified: true,
        role: "recruiter",
        email: "attacker@example.com",
      },
      nowMs: nowMs + 1000,
    });

    expect(afterSpoof.signupPending).toBe(true);
    expect(afterSpoof.email).toBe("new@example.com");
    expect(afterSpoof.role).toBeUndefined();
    expect(afterSpoof.ageVerified).toBe(false);
    expect(afterSpoof.id).toBeUndefined();
  });

  it("expires and consumes the pending token after 15 minutes", () => {
    const pending = applyJwtCallback({
      token: {},
      user: { email: "new@example.com", signupPending: true },
      nowMs,
    });

    const expired = applyJwtCallback({
      token: pending,
      nowMs: nowMs + PENDING_SIGNUP_MAX_AGE_SECONDS * 1000,
    });

    expect(expired).toEqual({});
    expect(
      isActivePendingSignup({
        signupPending: true,
        signupPendingExpiresAt: pending.signupPendingExpiresAt,
        nowMs: nowMs + PENDING_SIGNUP_MAX_AGE_SECONDS * 1000,
      })
    ).toBe(false);
  });

  it("expired pending tokens do not look like unverified app users", () => {
    const pending = applyJwtCallback({
      token: {},
      user: { email: "new@example.com", signupPending: true },
      nowMs,
    });
    const sessionUser = toPublicSessionUser({
      ...pending,
      signupPendingExpiresAt: nowMs - 1,
    });
    expect(sessionUser.signupPending).toBe(false);
    expect(sessionUser.id).toBe("");
    expect(sessionUser.role).toBeUndefined();
    expect(sessionUser.email).toBeNull();
  });

  it("does not expose an app role on the public session while pending", () => {
    const pending = applyJwtCallback({
      token: {},
      user: { email: "new@example.com", name: "New", signupPending: true },
      nowMs,
    });
    const sessionUser = toPublicSessionUser(pending);
    expect(sessionUser.signupPending).toBe(true);
    expect(sessionUser.id).toBe("");
    expect(sessionUser.role).toBeUndefined();
    expect(sessionUser.ageVerified).toBe(false);
    expect(sessionUser.email).toBe("new@example.com");
  });

  it("existing worker login still copies the real app user into the JWT", () => {
    const token = applyJwtCallback({
      token: {},
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "worker1@example.com",
        role: "worker",
        ageVerified: true,
      },
      nowMs,
    });

    expect(token.signupPending).toBe(false);
    expect(token.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(token.role).toBe("worker");
    expect(token.ageVerified).toBe(true);
  });

  it("client cannot change an existing user's role via session.update", () => {
    const token = applyJwtCallback({
      token: {
        id: "11111111-1111-4111-8111-111111111111",
        role: "worker",
        ageVerified: true,
      },
      trigger: "update",
      session: { role: "recruiter", ageVerified: true },
      nowMs,
    });

    expect(token.role).toBe("worker");
  });
});
