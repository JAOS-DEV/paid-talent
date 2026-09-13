import { describe, it, expect } from "vitest";
import {
  applyJwtSessionUpdate,
  getPostAgeVerificationRedirect,
  isValidSignupIntentRole,
  resolveProviderSignInDecision,
} from "../sign-in-decision";

describe("resolveProviderSignInDecision", () => {
  const email = "user@example.com";

  describe("REGRESSION: never abort to /auth/age-verification", () => {
    it("existing Google user with ageVerified=false completes sign-in (not age-verification URL)", () => {
      const decision = resolveProviderSignInDecision({
        existingUser: {
          id: "u1",
          role: "worker",
          ageVerified: false,
        },
        signupIntentRole: undefined,
        email,
      });

      expect(decision.kind).toBe("complete_existing");
      if (decision.kind === "complete_existing") {
        expect(decision.user.ageVerified).toBe(false);
        expect(decision.user.role).toBe("worker");
      }
      expect(JSON.stringify(decision)).not.toContain("/auth/age-verification");
    });

    it("existing email user with ageVerified=false completes sign-in", () => {
      const decision = resolveProviderSignInDecision({
        existingUser: {
          id: "u2",
          role: "recruiter",
          ageVerified: false,
        },
        signupIntentRole: "recruiter",
        email,
      });

      expect(decision).toEqual({
        kind: "complete_existing",
        user: { id: "u2", role: "recruiter", ageVerified: false },
      });
    });
  });

  describe("new users with signup_intent_role", () => {
    it("creates and completes for worker intent with ageVerified=false", () => {
      const decision = resolveProviderSignInDecision({
        existingUser: null,
        signupIntentRole: "worker",
        email,
      });

      expect(decision).toEqual({
        kind: "create_and_complete",
        role: "worker",
      });
    });

    it("creates and completes for recruiter intent", () => {
      const decision = resolveProviderSignInDecision({
        existingUser: null,
        signupIntentRole: "recruiter",
        email,
      });

      expect(decision).toEqual({
        kind: "create_and_complete",
        role: "recruiter",
      });
    });

    it("preserves role through create_and_complete (worker)", () => {
      const decision = resolveProviderSignInDecision({
        existingUser: null,
        signupIntentRole: "worker",
        email,
      });
      expect(decision.kind).toBe("create_and_complete");
      if (decision.kind === "create_and_complete") {
        expect(decision.role).toBe("worker");
      }
    });
  });

  describe("new users without valid signup intent", () => {
    it("redirects to role-select when no signup intent", () => {
      const decision = resolveProviderSignInDecision({
        existingUser: null,
        signupIntentRole: undefined,
        email,
      });

      expect(decision).toEqual({
        kind: "abort_redirect",
        url: "/auth/role-select?email=" + encodeURIComponent(email),
      });
    });

    it("redirects to role-select for invalid signup intent (does not silently create)", () => {
      const decision = resolveProviderSignInDecision({
        existingUser: null,
        signupIntentRole: "admin",
        email,
      });

      expect(decision.kind).toBe("abort_redirect");
      if (decision.kind === "abort_redirect") {
        expect(decision.url).toContain("/auth/role-select");
        expect(decision.url).toContain(encodeURIComponent(email));
      }
    });

    it("redirects to role-select for empty signup intent", () => {
      const decision = resolveProviderSignInDecision({
        existingUser: null,
        signupIntentRole: "",
        email,
      });

      expect(decision.kind).toBe("abort_redirect");
    });
  });

  describe("existing verified users", () => {
    it("completes sign-in normally for ageVerified=true worker", () => {
      const decision = resolveProviderSignInDecision({
        existingUser: {
          id: "u3",
          role: "worker",
          ageVerified: true,
        },
        signupIntentRole: undefined,
        email,
      });

      expect(decision).toEqual({
        kind: "complete_existing",
        user: { id: "u3", role: "worker", ageVerified: true },
      });
    });

    it("completes sign-in normally for ageVerified=true recruiter", () => {
      const decision = resolveProviderSignInDecision({
        existingUser: {
          id: "u4",
          role: "recruiter",
          ageVerified: true,
        },
        signupIntentRole: "worker",
        email,
      });

      // Existing user wins; signup intent ignored
      expect(decision).toEqual({
        kind: "complete_existing",
        user: { id: "u4", role: "recruiter", ageVerified: true },
      });
    });
  });
});

describe("isValidSignupIntentRole", () => {
  it("accepts worker and recruiter only", () => {
    expect(isValidSignupIntentRole("worker")).toBe(true);
    expect(isValidSignupIntentRole("recruiter")).toBe(true);
    expect(isValidSignupIntentRole("admin")).toBe(false);
    expect(isValidSignupIntentRole(undefined)).toBe(false);
  });
});

describe("applyJwtSessionUpdate", () => {
  it("after verify-age, updates JWT ageVerified to true while preserving role", () => {
    const updated = applyJwtSessionUpdate({
      tokenRole: "worker",
      tokenAgeVerified: false,
      sessionAgeVerified: true,
    });

    expect(updated.ageVerified).toBe(true);
    expect(updated.role).toBe("worker");
  });

  it("preserves recruiter role when ageVerified flips to true", () => {
    const updated = applyJwtSessionUpdate({
      tokenRole: "recruiter",
      tokenAgeVerified: false,
      sessionAgeVerified: true,
    });

    expect(updated).toEqual({
      role: "recruiter",
      ageVerified: true,
    });
  });

  it("allows leaving age-verification once ageVerified=true (gate uses this flag)", () => {
    const before = applyJwtSessionUpdate({
      tokenRole: "worker",
      tokenAgeVerified: false,
    });
    expect(before.ageVerified).toBe(false);

    const after = applyJwtSessionUpdate({
      tokenRole: "worker",
      tokenAgeVerified: false,
      sessionAgeVerified: true,
    });
    expect(after.ageVerified).toBe(true);
  });
});

describe("getPostAgeVerificationRedirect", () => {
  it("sends workers to onboarding", () => {
    expect(getPostAgeVerificationRedirect("worker")).toBe("/worker/onboarding");
  });

  it("sends recruiters to dashboard", () => {
    expect(getPostAgeVerificationRedirect("recruiter")).toBe(
      "/recruiter/dashboard"
    );
  });
});
