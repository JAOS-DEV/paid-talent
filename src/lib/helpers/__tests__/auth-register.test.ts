import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { resolveProviderSignInDecision } from "@/lib/auth/sign-in-decision";

const SRC_ROOT = path.join(process.cwd(), "src");
const REGISTER_ROUTE = path.join(
  SRC_ROOT,
  "app/api/auth/register/route.ts"
);

function collectTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === "__tests__"
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

describe("legacy /api/auth/register is removed", () => {
  it("does not ship an unauthenticated register route", () => {
    expect(fs.existsSync(REGISTER_ROUTE)).toBe(false);
  });

  it("no active frontend or API code references /api/auth/register", () => {
    const files = collectTsFiles(path.join(SRC_ROOT, "app")).concat(
      collectTsFiles(path.join(SRC_ROOT, "components")),
      collectTsFiles(path.join(SRC_ROOT, "lib"))
    );
    const offenders = files.filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return source.includes("/api/auth/register");
    });
    expect(offenders).toEqual([]);
  });

  it("signin has no legacy role+dob account creation path", () => {
    const signin = fs.readFileSync(
      path.join(SRC_ROOT, "app/auth/signin/page.tsx"),
      "utf8"
    );
    expect(signin).not.toContain("isLegacySignupMode");
    expect(signin).not.toContain("isSignupMode");
    expect(signin).not.toContain("/api/auth/register");
    expect(signin).not.toMatch(/searchParams\.get\(["']dob["']\)/);
    expect(signin).not.toMatch(/callbackUrl.*dob=/);
  });

  it("signup pages do not put DOB in query parameters", () => {
    const files = [
      "app/auth/signin/page.tsx",
      "app/auth/age-gate/page.tsx",
      "app/auth/role-select/page.tsx",
      "app/page.tsx",
    ];
    for (const relative of files) {
      const source = fs.readFileSync(path.join(SRC_ROOT, relative), "utf8");
      expect(source).not.toMatch(/params\.set\(["']dob["']/);
      expect(source).not.toMatch(/[?&]dob=/);
    }
  });
});

describe("canonical signup after register-route removal", () => {
  it("new Google signup still creates from validated signup intent only", () => {
    const withIntent = resolveProviderSignInDecision({
      existingUser: null,
      signupIntentRole: "worker",
      email: "new@example.com",
    });
    expect(withIntent).toEqual({
      kind: "create_and_complete",
      role: "worker",
    });

    const withoutIntent = resolveProviderSignInDecision({
      existingUser: null,
      signupIntentRole: undefined,
      email: "unknown@example.com",
    });
    expect(withoutIntent.kind).toBe("complete_pending_signup");
  });

  it("existing users still complete sign-in without the register route", () => {
    const decision = resolveProviderSignInDecision({
      existingUser: {
        id: "existing",
        role: "recruiter",
        ageVerified: true,
      },
      signupIntentRole: "worker",
      email: "recruiter@example.com",
    });
    expect(decision).toEqual({
      kind: "complete_existing",
      user: {
        id: "existing",
        role: "recruiter",
        ageVerified: true,
      },
    });
  });
});
