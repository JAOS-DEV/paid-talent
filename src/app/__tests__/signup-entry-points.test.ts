import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  resolveProviderSignInDecision,
  getPostAgeVerificationRedirect,
} from "@/lib/auth/sign-in-decision";
import { resolveMiddlewareGate } from "@/lib/auth/middleware-gate";
import { getSessionHomePath } from "@/lib/auth/middleware-paths";
import { meetsMinimumAge } from "@/lib/helpers/age-verification";

const SRC_ROOT = path.join(process.cwd(), "src");

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relativePath), "utf8");
}

function collectTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "__tests__" ||
        entry.name === ".next"
      ) {
        continue;
      }
      files.push(...collectTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe("public signup entry points", () => {
  it("Header Get Started starts signup at role selection", () => {
    const header = readSrc("components/layout/Header.tsx");
    expect(header).toMatch(/href=["']\/auth\/role-select["']/);
    expect(header).toMatch(/>\s*Get Started\s*</);
  });

  it("Header Sign in goes to /auth/signin", () => {
    const header = readSrc("components/layout/Header.tsx");
    expect(header).toMatch(/href=["']\/auth\/signin["']/);
  });

  it("Create Worker Profile goes to age-gate with role=worker", () => {
    const home = readSrc("app/page.tsx");
    expect(home).toMatch(
      /href=["']\/auth\/age-gate\?role=worker["'][\s\S]*Create Worker Profile/
    );
  });

  it("Start Recruiting goes to age-gate with role=recruiter", () => {
    const home = readSrc("app/page.tsx");
    expect(home).toMatch(
      /href=["']\/auth\/age-gate\?role=recruiter["'][\s\S]*Start Recruiting/
    );
  });

  it("Subscribe to Top Talent goes to age-gate with role=recruiter", () => {
    const home = readSrc("app/page.tsx");
    expect(home).toMatch(
      /href=["']\/auth\/age-gate\?role=recruiter["'][\s\S]*Subscribe to Top Talent/
    );
  });

  it("no public signup CTA links directly to /auth/age-verification", () => {
    const publicSources = [
      readSrc("app/page.tsx"),
      readSrc("components/layout/Header.tsx"),
      readSrc("components/layout/Footer.tsx"),
      readSrc("app/auth/role-select/page.tsx"),
      readSrc("app/auth/age-gate/page.tsx"),
      readSrc("app/auth/signin/page.tsx"),
    ];

    for (const source of publicSources) {
      expect(source).not.toMatch(/href=["']\/auth\/age-verification/);
    }
  });

  it("footer role CTAs skip role-select and go to age-gate", () => {
    const footer = readSrc("components/layout/Footer.tsx");
    expect(footer).toContain('href="/auth/age-gate?role=worker"');
    expect(footer).toContain('href="/auth/age-gate?role=recruiter"');
    expect(footer).not.toMatch(/href=["']\/auth\/role-select\?role=/);
  });

  it("does not put date of birth into the signup-intent cookie helper", () => {
    const helper = readSrc("lib/auth/signup-intent.ts");
    const action = readSrc("lib/auth/signup-intent-action.ts");
    expect(helper).not.toMatch(/dateOfBirth|dob/i);
    expect(action).not.toMatch(/dateOfBirth|dob/i);
    expect(helper).toContain("signup_intent_role");
  });

  it("age-gate sets signup intent before signin rather than waiting for Google click only", () => {
    const ageGate = readSrc("app/auth/age-gate/page.tsx");
    expect(ageGate).toContain("persistSignupIntentRole");
    expect(ageGate).toContain("/auth/signin");
    expect(ageGate).toContain("ageConfirmed");
    expect(ageGate).toContain("pendingSignup");
    expect(ageGate).toContain("/auth/age-verification");
  });

  it("role-select does not treat email query params as identity", () => {
    const roleSelect = readSrc("app/auth/role-select/page.tsx");
    expect(roleSelect).not.toContain('searchParams.get("email")');
    expect(roleSelect).not.toContain("params.set(\"email\"");
    expect(roleSelect).toContain("Looks like you're new to Paid Talent");
    expect(roleSelect).toContain("Let's finish creating your account.");
  });

  it("hard DOB page is DOB-only with no second 20+ checkbox", () => {
    const source = readSrc("app/auth/age-verification/page.tsx");
    expect(source).toMatch(/type=["']date["']/);
    expect(source).toContain("Verify & continue");
    expect(source).toContain("updateSession({ ageVerified: true })");
    expect(source).not.toMatch(/type=["']checkbox["']/);
    expect(source).not.toMatch(/I confirm I am 20 or older/);
  });

  it("signin page no longer writes signup_intent_role via document.cookie", () => {
    const signin = readSrc("app/auth/signin/page.tsx");
    expect(signin).not.toMatch(/document\.cookie/);
    expect(signin).not.toContain("persistSignupIntentRole");
    expect(signin).not.toContain("ensureSignupIntentCookie");
  });

  it("signin does not mint signup intent from role/ageConfirmed query params", () => {
    const signin = readSrc("app/auth/signin/page.tsx");
    expect(signin).not.toContain("persistSignupIntentRole");
    expect(signin).not.toContain("signup-intent-action");
    expect(signin).not.toMatch(/ageConfirmed/);
    expect(signin).not.toContain("/api/auth/register");
    expect(signin).not.toContain("isLegacySignupMode");
  });

  it("only the age-gate server action mints signup_intent_role", () => {
    const action = readSrc("lib/auth/signup-intent-action.ts");
    const ageGate = readSrc("app/auth/age-gate/page.tsx");
    const signin = readSrc("app/auth/signin/page.tsx");
    const config = readSrc("lib/auth/config.ts");

    expect(action).toContain("persistSignupIntentRole");
    expect(ageGate).toContain("persistSignupIntentRole");
    expect(signin).not.toContain("persistSignupIntentRole");
    expect(config).not.toContain("persistSignupIntentRole");
    expect(config).toContain("consumeSignupIntentCookie");
    expect(config).toContain("shouldConsumeSignupIntent");
  });
});

describe("canonical signup lifecycle (single authentication)", () => {
  it("new Google signup with worker intent authenticates once then hard-DOB gates", () => {
    const signInDecision = resolveProviderSignInDecision({
      existingUser: null,
      signupIntentRole: "worker",
      email: "new-worker@example.com",
    });
    expect(signInDecision).toEqual({
      kind: "create_and_complete",
      role: "worker",
    });

    const afterOAuth = resolveMiddlewareGate({
      pathname: "/",
      hasSession: true,
      ageVerified: false,
      isApiRoute: false,
      isAuthApiRoute: false,
    });
    expect(afterOAuth).toEqual({
      action: "redirect",
      destination: "/auth/age-verification",
    });

    const dobPage = resolveMiddlewareGate({
      pathname: "/auth/age-verification",
      hasSession: true,
      ageVerified: false,
      isApiRoute: false,
      isAuthApiRoute: false,
    });
    expect(dobPage).toEqual({ action: "allow" });
    expect(getPostAgeVerificationRedirect("worker")).toBe("/worker/onboarding");
  });

  it("new Google signup with recruiter intent follows the same single-auth path", () => {
    const signInDecision = resolveProviderSignInDecision({
      existingUser: null,
      signupIntentRole: "recruiter",
      email: "new-recruiter@example.com",
    });
    expect(signInDecision.kind).toBe("create_and_complete");

    const afterOAuth = resolveMiddlewareGate({
      pathname: "/recruiter/dashboard",
      hasSession: true,
      ageVerified: false,
      isApiRoute: false,
      isAuthApiRoute: false,
    });
    expect(afterOAuth).toEqual({
      action: "redirect",
      destination: "/auth/age-verification",
    });
    expect(getPostAgeVerificationRedirect("recruiter")).toBe(
      "/recruiter/dashboard"
    );
  });

  it("existing verified worker login goes to worker dashboard", () => {
    const decision = resolveProviderSignInDecision({
      existingUser: {
        id: "w1",
        role: "worker",
        ageVerified: true,
      },
      signupIntentRole: undefined,
      email: "worker1@example.com",
    });
    expect(decision.kind).toBe("complete_existing");
    expect(getSessionHomePath("worker")).toBe("/worker/dashboard");
  });

  it("existing verified recruiter login goes to recruiter dashboard", () => {
    const decision = resolveProviderSignInDecision({
      existingUser: {
        id: "r1",
        role: "recruiter",
        ageVerified: true,
      },
      signupIntentRole: undefined,
      email: "recruiter@example.com",
    });
    expect(decision.kind).toBe("complete_existing");
    expect(getSessionHomePath("recruiter")).toBe("/recruiter/dashboard");
  });

  it("existing unverified login goes to DOB verification, not role-select", () => {
    const decision = resolveProviderSignInDecision({
      existingUser: {
        id: "u1",
        role: "worker",
        ageVerified: false,
      },
      signupIntentRole: undefined,
      email: "unverified@example.com",
    });
    expect(decision.kind).toBe("complete_existing");

    const gate = resolveMiddlewareGate({
      pathname: "/worker/dashboard",
      hasSession: true,
      ageVerified: false,
      isApiRoute: false,
      isAuthApiRoute: false,
    });
    expect(gate).toEqual({
      action: "redirect",
      destination: "/auth/age-verification",
    });
  });

  it("hard DOB verification writes DOB only after auth via verify-age", () => {
    const verifyAge = readSrc("app/api/auth/verify-age/route.ts");
    expect(verifyAge).toContain("completeAgeVerification");
    expect(verifyAge).toContain("dateOfBirth");
    expect(verifyAge).toContain("signupIntentRole");
    expect(verifyAge).not.toContain("validation.data.email");
    expect(verifyAge).not.toContain("body.email");
    expect(verifyAge).not.toContain("body.role");

    const registerGone = path.join(
      process.cwd(),
      "src/app/api/auth/register/route.ts"
    );
    expect(fs.existsSync(registerGone)).toBe(false);
  });

  it("DOB 20+ is accepted and under 20 is rejected by the shared helper", () => {
    const reference = new Date("2026-09-14");
    expect(meetsMinimumAge(new Date("2000-01-01"), reference)).toBe(true);
    expect(meetsMinimumAge(new Date("2010-01-01"), reference)).toBe(false);
  });

  it("a brand-new Google account without a valid intent stays pending (no user row yet)", () => {
    const decision = resolveProviderSignInDecision({
      existingUser: null,
      signupIntentRole: undefined,
      email: "unknown@example.com",
    });
    expect(decision.kind).toBe("complete_pending_signup");
  });

  it("stale worker intent cannot create a second unknown Google account once consumed", () => {
    const first = resolveProviderSignInDecision({
      existingUser: null,
      signupIntentRole: "worker",
      email: "first@example.com",
    });
    expect(first.kind).toBe("create_and_complete");

    const afterConsume = resolveProviderSignInDecision({
      existingUser: null,
      signupIntentRole: undefined,
      email: "second@example.com",
    });
    expect(afterConsume.kind).toBe("complete_pending_signup");
  });

  it("existing-user auth ignores a stale signup intent", () => {
    const decision = resolveProviderSignInDecision({
      existingUser: {
        id: "existing-worker",
        role: "worker",
        ageVerified: true,
      },
      signupIntentRole: "recruiter",
      email: "worker1@example.com",
    });
    expect(decision).toEqual({
      kind: "complete_existing",
      user: {
        id: "existing-worker",
        role: "worker",
        ageVerified: true,
      },
    });
  });
});

describe("no competing public signup flows in app source", () => {
  it("no page/component href points at post-auth age-verification", () => {
    const files = collectTsFiles(path.join(SRC_ROOT, "app")).concat(
      collectTsFiles(path.join(SRC_ROOT, "components"))
    );
    const offenders = files.filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return /href=["'`]\/auth\/age-verification/.test(source);
    });
    expect(offenders).toEqual([]);
  });
});
