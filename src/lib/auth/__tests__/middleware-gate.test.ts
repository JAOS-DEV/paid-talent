import { describe, it, expect } from "vitest";
import {
  AGE_VERIFICATION_PATH,
  isMachineApiRoute,
  isPublicAuthRoute,
  resolveMiddlewareGate,
} from "../middleware-gate";

describe("resolveMiddlewareGate", () => {
  describe("anonymous users", () => {
    it("allows public pre-auth routes", () => {
      for (const pathname of [
        "/",
        "/how-it-works",
        "/top-talent",
        "/privacy",
        "/terms",
        "/auth/signin",
        "/auth/role-select",
        "/auth/age-gate",
        "/auth/verify-request",
        "/auth/error",
        "/auth/account-restricted",
        "/auth/signout",
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

    it("lets guests reach unknown pages so Next can render 404", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/no-such-page",
          hasSession: false,
          ageVerified: false,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({ action: "allow" });
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

    it("redirects unauthenticated onboarding access to signin", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/worker/onboarding",
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

    it("requires a session for /settings (not public)", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/settings/notifications",
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
    it("lets age-unverified users open unknown pages and sign out", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/no-such-page",
          hasSession: true,
          ageVerified: false,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({ action: "allow" });
      expect(
        resolveMiddlewareGate({
          pathname: "/auth/signout",
          hasSession: true,
          ageVerified: false,
          isApiRoute: false,
          isAuthApiRoute: false,
        })
      ).toEqual({ action: "allow" });
    });

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

    it("redirects Worker onboarding to age-verification", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/worker/onboarding",
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

    it("REGRESSION: after first successful OAuth, ageVerified=false goes to DOB page not signin", () => {
      const result = resolveMiddlewareGate({
        pathname: "/",
        hasSession: true,
        ageVerified: false,
        isApiRoute: false,
        isAuthApiRoute: false,
      });

      expect(result).toEqual({
        action: "redirect",
        destination: AGE_VERIFICATION_PATH,
      });
      expect(JSON.stringify(result)).not.toContain("/auth/signin");
    });

    it("REGRESSION: authenticated DOB page does not bounce back to signin", () => {
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

    it("allows Worker onboarding after age verification", () => {
      expect(
        resolveMiddlewareGate({
          pathname: "/worker/onboarding",
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

describe("machine API routes (webhooks / cron)", () => {
  it("allows unauthenticated POST /api/stripe/webhook", () => {
    expect(
      resolveMiddlewareGate({
        pathname: "/api/stripe/webhook",
        hasSession: false,
        ageVerified: false,
        isApiRoute: true,
        isAuthApiRoute: false,
      })
    ).toEqual({ action: "allow" });
  });

  it("still requires a session for /api/stripe/checkout", () => {
    expect(
      resolveMiddlewareGate({
        pathname: "/api/stripe/checkout",
        hasSession: false,
        ageVerified: false,
        isApiRoute: true,
        isAuthApiRoute: false,
      })
    ).toEqual({ action: "json", status: 401, error: "Unauthorized" });
  });

  it("does not allow /api/cronx (prefix boundary)", () => {
    expect(isMachineApiRoute("/api/cron")).toBe(true);
    expect(isMachineApiRoute("/api/cron/retention")).toBe(true);
    expect(isMachineApiRoute("/api/cronx")).toBe(false);
    expect(
      resolveMiddlewareGate({
        pathname: "/api/cronx",
        hasSession: false,
        ageVerified: false,
        isApiRoute: true,
        isAuthApiRoute: false,
      })
    ).toEqual({ action: "json", status: 401, error: "Unauthorized" });
  });
});

describe("pending signup sessions (Google already verified, no account yet)", () => {
  it("does not send unknown Sign-in users back to Sign in", () => {
    expect(
      resolveMiddlewareGate({
        pathname: "/auth/signin",
        hasSession: false,
        ageVerified: false,
        isApiRoute: false,
        isAuthApiRoute: false,
        signupPending: true,
      })
    ).toEqual({
      action: "redirect",
      destination: "/auth/role-select",
    });
  });

  it("allows role selection and age-gate continuation pages", () => {
    for (const pathname of ["/auth/role-select", "/auth/age-gate"]) {
      expect(
        resolveMiddlewareGate({
          pathname,
          hasSession: false,
          ageVerified: false,
          isApiRoute: false,
          isAuthApiRoute: false,
          signupPending: true,
        })
      ).toEqual({ action: "allow" });
    }
  });

  it("blocks DOB until the server-minted signup intent exists", () => {
    expect(
      resolveMiddlewareGate({
        pathname: AGE_VERIFICATION_PATH,
        hasSession: false,
        ageVerified: false,
        isApiRoute: false,
        isAuthApiRoute: false,
        signupPending: true,
        hasSignupIntent: false,
      })
    ).toEqual({
      action: "redirect",
      destination: "/auth/role-select",
    });
  });

  it("allows DOB after role + 20+ gate minted the intent cookie", () => {
    expect(
      resolveMiddlewareGate({
        pathname: AGE_VERIFICATION_PATH,
        hasSession: false,
        ageVerified: false,
        isApiRoute: false,
        isAuthApiRoute: false,
        signupPending: true,
        hasSignupIntent: true,
      })
    ).toEqual({ action: "allow" });
  });

  it("unknown identity cannot access Worker or Recruiter routes prematurely", () => {
    for (const pathname of [
      "/worker/dashboard",
      "/worker/onboarding",
      "/recruiter/dashboard",
      "/search",
    ]) {
      expect(
        resolveMiddlewareGate({
          pathname,
          hasSession: false,
          ageVerified: false,
          isApiRoute: false,
          isAuthApiRoute: false,
          signupPending: true,
        })
      ).toEqual({
        action: "redirect",
        destination: "/auth/role-select",
      });
    }
  });

  it("unknown identity cannot call protected APIs", () => {
    expect(
      resolveMiddlewareGate({
        pathname: "/api/worker/profile",
        hasSession: false,
        ageVerified: false,
        isApiRoute: true,
        isAuthApiRoute: false,
        signupPending: true,
      })
    ).toEqual({
      action: "json",
      status: 403,
      error: "Finish creating your account",
    });
  });

  it("REGRESSION: pending users hitting home are not bounced to signin", () => {
    const result = resolveMiddlewareGate({
      pathname: "/",
      hasSession: false,
      ageVerified: false,
      isApiRoute: false,
      isAuthApiRoute: false,
      signupPending: true,
    });
    expect(result).toEqual({
      action: "redirect",
      destination: "/auth/role-select",
    });
    expect(JSON.stringify(result)).not.toContain("/auth/signin");
  });
});
