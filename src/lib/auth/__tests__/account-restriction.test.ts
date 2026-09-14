import { describe, expect, it } from "vitest";
import { resolveProviderSignInDecision } from "../sign-in-decision";
import { resolveAccountRestriction } from "../account-restriction";
import { isSelfModerationTarget } from "@/lib/admin/account-moderation";

describe("durable ban and suspension sign-in decisions", () => {
  it("blocks existing login for an active durable ban", () => {
    const decision = resolveProviderSignInDecision({
      existingUser: {
        id: "u1",
        role: "worker",
        ageVerified: true,
        accountStatus: "active",
      },
      signupIntentRole: undefined,
      email: "banned@example.com",
      hasActiveBan: true,
    });
    expect(decision).toEqual({
      kind: "abort_redirect",
      url: "/auth/account-restricted?reason=banned",
    });
  });

  it("blocks pending signup creation for a banned identity", () => {
    const decision = resolveProviderSignInDecision({
      existingUser: null,
      signupIntentRole: undefined,
      email: "banned@example.com",
      hasActiveBan: true,
    });
    expect(decision.kind).toBe("abort_redirect");
    if (decision.kind === "abort_redirect") {
      expect(decision.url).toContain("reason=banned");
    }
  });

  it("blocks create_and_complete for a banned identity with a signup intent", () => {
    const decision = resolveProviderSignInDecision({
      existingUser: null,
      signupIntentRole: "worker",
      email: "banned@example.com",
      hasActiveBan: true,
    });
    expect(decision.kind).toBe("abort_redirect");
  });

  it("blocks a suspended existing user from completing sign-in", () => {
    const decision = resolveProviderSignInDecision({
      existingUser: {
        id: "u2",
        role: "recruiter",
        ageVerified: true,
        accountStatus: "suspended",
      },
      signupIntentRole: undefined,
      email: "suspended@example.com",
      hasActiveBan: false,
    });
    expect(decision).toEqual({
      kind: "abort_redirect",
      url: "/auth/account-restricted?reason=suspended",
    });
  });

  it("leaves unrelated identities able to sign in", () => {
    const decision = resolveProviderSignInDecision({
      existingUser: {
        id: "u3",
        role: "worker",
        ageVerified: true,
        accountStatus: "active",
      },
      signupIntentRole: undefined,
      email: "ok@example.com",
      hasActiveBan: false,
    });
    expect(decision.kind).toBe("complete_existing");
  });

  it("treats an active ban as stronger than a still-active user row", () => {
    expect(
      resolveAccountRestriction({
        hasActiveBan: true,
        accountStatus: "active",
      })
    ).toBe("banned");
  });
});

describe("self-moderation protection", () => {
  it("rejects self-ban and self-suspend by user id or email", () => {
    expect(
      isSelfModerationTarget({
        actorUserId: "a",
        actorEmail: "admin@example.com",
        targetUserId: "a",
        targetEmail: "admin@example.com",
      })
    ).toBe(true);
    expect(
      isSelfModerationTarget({
        actorUserId: "a",
        actorEmail: "Admin@example.com",
        targetUserId: "b",
        targetEmail: "admin@example.com",
      })
    ).toBe(true);
    expect(
      isSelfModerationTarget({
        actorUserId: "a",
        actorEmail: "admin@example.com",
        targetUserId: "b",
        targetEmail: "worker@example.com",
      })
    ).toBe(false);
  });
});
