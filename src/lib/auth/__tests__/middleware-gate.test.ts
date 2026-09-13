import { describe, it, expect } from "vitest";
import {
  AGE_VERIFICATION_PATH,
  isPublicAuthRoute,
  resolveMiddlewareGate,
} from "../middleware-gate";

describe("resolveMiddlewareGate", () => {
  describe("anonymous users", () => {
    it("allows public pre-auth routes", () => {
      for (const pathname of [
        "/",
        "/auth/signin",
        "/auth/role-select",
        "/auth/age-gate",
        "/auth/verify-request",
        "/auth/error",
      ]) {
        expect(
          resolveMiddlewareGate({
            pathname,
            hasSession: false,
            ageVerified: false,
            isApiRoute: false,
            isAuthApiRoute: false,
          })
        ).toEqual({ action: "allow" });
      }
    });

    it("REGRESSION: anonymous users cannot use post-auth DOB page", () => {
      const result = resolveMiddlewareGate({
        pathname: AGE_VERIFICATION_PATH,
        hasSession: false,
        ageVerified: false,
        isApiRoute: false,
        isAuthApiRoute: false,
      });

      expect(result).toEqual({
        action: "redirect",
        destination: "/auth/signin",
        setCallbackUrl: true,
      });
    });

    it("redirects protected worker routes to signin", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/worker/dashboard",
          hasSession: false,
          ageVerified: false,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({
        action: "redirect",
        destination: "/auth/signin",
        setCallbackUrl: true,
      });
    });

    it("redirects protected recruiter routes to signin", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/recruiter/dashboard",
          hasSession: false,
          ageVerified: false,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({
        action: "redirect",
        destination: "/auth/signin",
        setCallbackUrl: true,
      });
    });
  });

  describe("authenticated unverified users (ageVerified=false)", () => {
    it("permits /auth/age-verification", () => {
      expect(
        resolveMiddlewareGate({
          pathname: AGE_VERIFICATION_PATH,
          hasSession: true,
          ageVerified: false,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({ action: "allow" });
    });

    it("redirects Worker dashboard to age-verification", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/worker/dashboard",
          hasSession: true,
          ageVerified: false,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({
        action: "redirect",
        destination: AGE_VERIFICATION_PATH,
      });
    });

    it("redirects Recruiter dashboard to age-verification", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/recruiter/dashboard",
          hasSession: true,
          ageVerified: false,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({
        action: "redirect",
        destination: AGE_VERIFICATION_PATH,
      });
    });

    it("REGRESSION: redirects /auth/signin to age-verification (breaks signin↔age loop)", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/auth/signin",
          hasSession: true,
          ageVerified: false,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({
        action: "redirect",
        destination: AGE_VERIFICATION_PATH,
      });
    });

    it("redirects / and age-gate to age-verification (no loop among public pages)", () => {
      for (const pathname of ["/", "/auth/age-gate", "/auth/role-select"]) {
        expect(
          resolveMiddlewareGate({
            pathname,
            hasSession: true,
            ageVerified: false,
            isApiRoute: false,
            isAuthApiRoute: false,
          })
        ).toEqual({
          action: "redirect",
          destination: AGE_VERIFICATION_PATH,
        });
      }
    });

    it("allows /api/auth/* including verify-age", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/api/auth/verify-age",
          hasSession: true,
          ageVerified: false,
          isApiRoute: true,
          isAuthApiRoute: true,
        })
      ).toEqual({ action: "allow" });
    });

    it("blocks non-auth API with 403", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/api/worker/profile",
          hasSession: true,
          ageVerified: false,
          isApiRoute: true,
          isAuthApiRoute: false,
        })
      ).toEqual({
        action: "json",
        status: 403,
        error: "Age verification required",
      });
    });
  });

  describe("authenticated verified users (ageVerified=true)", () => {
    it("allows leaving age-verification and reaching Worker dashboard", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/worker/dashboard",
          hasSession: true,
          ageVerified: true,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({ action: "allow" });
    });

    it("allows Recruiter dashboard", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/recruiter/dashboard",
          hasSession: true,
          ageVerified: true,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({ action: "allow" });
    });

    it("allows home and age-verification path (no forced loop back)", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/",
          hasSession: true,
          ageVerified: true,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({ action: "allow" });

      expect(
        resolveMiddlewareGate({
          pathname: AGE_VERIFICATION_PATH,
          hasSession: true,
          ageVerified: true,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({ action: "allow" });
    });
  });
});

describe("isPublicAuthRoute", () => {
  it("treats age-gate as public but not age-verification", () => {
    expect(isPublicAuthRoute("/auth/age-gate")).toBe(true);
    expect(isPublicAuthRoute("/auth/age-verification")).toBe(false);
  });
});
