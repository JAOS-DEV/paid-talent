import { describe, it, expect } from "vitest";
import {
  isSignupEntryRoute,
  resolveSignedInSignupRedirect,
} from "../middleware-paths";

describe("resolveSignedInSignupRedirect", () => {
  it("sends workers away from age-gate to worker dashboard", () => {
    expect(resolveSignedInSignupRedirect("/auth/age-gate", "worker")).toBe(
      "/worker/dashboard"
    );
  });

  it("sends recruiters away from signup/sign-in to recruiter dashboard", () => {
    expect(resolveSignedInSignupRedirect("/auth/age-gate", "recruiter")).toBe(
      "/recruiter/dashboard"
    );
    expect(resolveSignedInSignupRedirect("/auth/role-select", "recruiter")).toBe(
      "/recruiter/dashboard"
    );
    expect(resolveSignedInSignupRedirect("/auth/signin", "recruiter")).toBe(
      "/recruiter/dashboard"
    );
  });

  it("sends users without a role to role-select (except when already there)", () => {
    expect(resolveSignedInSignupRedirect("/auth/age-gate", undefined)).toBe(
      "/auth/role-select"
    );
    expect(resolveSignedInSignupRedirect("/auth/signin", undefined)).toBe(
      "/auth/role-select"
    );
    expect(resolveSignedInSignupRedirect("/auth/role-select", undefined)).toBe(
      null
    );
  });

  it("does not redirect non-signup routes", () => {
    expect(resolveSignedInSignupRedirect("/how-it-works", "worker")).toBe(null);
    expect(resolveSignedInSignupRedirect("/top-talent", "recruiter")).toBe(
      null
    );
    expect(resolveSignedInSignupRedirect("/worker/dashboard", "worker")).toBe(
      null
    );
  });
});

describe("isSignupEntryRoute", () => {
  it("matches age-gate, role-select, and signin", () => {
    expect(isSignupEntryRoute("/auth/age-gate")).toBe(true);
    expect(isSignupEntryRoute("/auth/role-select")).toBe(true);
    expect(isSignupEntryRoute("/auth/signin")).toBe(true);
    expect(isSignupEntryRoute("/auth/age-verification")).toBe(false);
    expect(isSignupEntryRoute("/privacy")).toBe(false);
  });
});
