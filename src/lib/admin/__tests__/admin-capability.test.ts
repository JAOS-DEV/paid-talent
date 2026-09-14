import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { resolveSessionIsAdmin } from "../allowlist";
import { canViewContactDetails } from "@/lib/helpers/contact-visibility";

const SRC_ROOT = path.join(process.cwd(), "src");

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relativePath), "utf8");
}

describe("admin capability derivation", () => {
  it("does not expose ADMIN_EMAILS to the Header client component", () => {
    const header = readSrc("components/layout/Header.tsx");
    expect(header).not.toContain("ADMIN_EMAILS");
    expect(header).not.toContain("NEXT_PUBLIC_ADMIN");
    expect(header).toContain("session?.user?.isAdmin");
    expect(header).toMatch(/>\s*Admin\s*</);
    expect(header).not.toContain("Admin Dashboard");
    expect(header).toContain("prefetch={false}");
  });

  it("derives session isAdmin from the allowlist helper, not a client-supplied role", () => {
    process.env.ADMIN_EMAILS = "staff@example.com";
    expect(
      resolveSessionIsAdmin({
        email: "staff@example.com",
        signupPending: false,
        userId: "11111111-1111-4111-8111-111111111111",
      })
    ).toBe(true);
    expect(
      resolveSessionIsAdmin({
        email: "worker@example.com",
        signupPending: false,
        userId: "11111111-1111-4111-8111-111111111111",
      })
    ).toBe(false);
    expect(
      resolveSessionIsAdmin({
        email: "staff@example.com",
        signupPending: true,
        userId: "",
      })
    ).toBe(false);
  });

  it("keeps AdminNav limited to pages that exist", () => {
    const nav = readSrc("components/admin/AdminNav.tsx");
    expect(nav).toContain('href: "/admin/users"');
    expect(nav).toContain('href: "/admin/activity"');
    expect(nav).toContain('href: "/admin/settings"');
    expect(nav).toContain("Back to app");
    expect(nav).toContain("Sign out");
    expect(nav).toContain("prefetch={false}");
    expect(nav).toContain("flex-wrap");
  });

  it("does not import ADMIN_EMAILS or the allowlist from client UI modules", () => {
    const header = readSrc("components/layout/Header.tsx");
    const nav = readSrc("components/admin/AdminNav.tsx");
    for (const source of [header, nav]) {
      expect(source).not.toContain("ADMIN_EMAILS");
      expect(source).not.toContain("getAdminEmailAllowlist");
      expect(source).not.toContain("@/lib/admin/allowlist");
      expect(source).not.toContain("NEXT_PUBLIC_ADMIN");
    }
  });

  it("blocks checkout while Open Access is active", () => {
    const checkout = readSrc("app/api/stripe/checkout/route.ts");
    expect(checkout).toContain('billingMode === "open_access"');
    expect(checkout).toContain("status: 409");
  });

  it("page guards re-check the server allowlist instead of trusting session.isAdmin", () => {
    const guard = readSrc("lib/admin/guard.ts");
    const apiGuard = readSrc("lib/admin/api-guard.ts");
    expect(guard).toContain("isAdminEmail(input.email)");
    expect(guard).not.toContain("session.user.isAdmin");
    expect(apiGuard).toContain("isAdminEmail(session.user.email)");
    expect(apiGuard).not.toContain("session.user.isAdmin");
  });
});

describe("Top Talent vs entitlement", () => {
  it("keeps Top Talent visually independent of entitlement in ranking source", () => {
    const ranking = readSrc("lib/ranking/index.ts");
    expect(ranking).not.toContain("getEffectiveEntitlement");
    expect(ranking).not.toContain("billingAccessMode");
    expect(ranking).not.toContain("open_access");
  });

  it("denies gated contact for Top Talent without entitlement in enforced mode", () => {
    expect(
      canViewContactDetails({
        isOwnProfile: false,
        isTopTalent: true,
        subscription: null,
        hasPremiumAccess: false,
      })
    ).toBe(false);
  });

  it("allows gated contact for Top Talent with entitlement", () => {
    expect(
      canViewContactDetails({
        isOwnProfile: false,
        isTopTalent: true,
        subscription: null,
        hasPremiumAccess: true,
      })
    ).toBe(true);
  });

  it("allows gated contact in open access even without a paid subscription", () => {
    expect(
      canViewContactDetails({
        isOwnProfile: false,
        isTopTalent: true,
        subscription: null,
        hasPremiumAccess: true,
      })
    ).toBe(true);
  });
});
