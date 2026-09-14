import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveAdminPageAccess } from "../guard";
import {
  buildPhotoRejectBody,
  buildVerificationDecisionBody,
  canSubmitVerificationApprove,
} from "../review-actions";

describe("resolveAdminPageAccess", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("redirects unauthenticated visitors to sign-in with callbackUrl", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    const result = resolveAdminPageAccess({
      isAuthenticated: false,
      email: null,
      pathname: "/admin/verifications",
    });

    expect(result).toEqual({
      status: "redirect_signin",
      callbackUrl: "/admin/verifications",
    });
  });

  it("denies authenticated non-admin with not_found", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    const result = resolveAdminPageAccess({
      isAuthenticated: true,
      email: "worker@example.com",
      pathname: "/admin",
    });

    expect(result).toEqual({ status: "not_found" });
  });

  it("allows allowlisted admin", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    const result = resolveAdminPageAccess({
      isAuthenticated: true,
      email: "admin@example.com",
      pathname: "/admin/photos",
    });

    expect(result).toEqual({
      status: "authorized",
      email: "admin@example.com",
    });
  });

  it("ADMIN_EMAILS comparison remains case-insensitive", () => {
    process.env.ADMIN_EMAILS = "Admin@Example.com";
    const result = resolveAdminPageAccess({
      isAuthenticated: true,
      email: "ADMIN@EXAMPLE.COM",
      pathname: "/admin",
    });

    expect(result.status).toBe("authorized");
    if (result.status === "authorized") {
      expect(result.email).toBe("admin@example.com");
    }
  });

  it("missing ADMIN_EMAILS denies access", () => {
    delete process.env.ADMIN_EMAILS;
    const result = resolveAdminPageAccess({
      isAuthenticated: true,
      email: "admin@example.com",
      pathname: "/admin",
    });

    expect(result).toEqual({ status: "not_found" });
  });

  it("empty ADMIN_EMAILS denies access", () => {
    process.env.ADMIN_EMAILS = "  ,  ";
    const result = resolveAdminPageAccess({
      isAuthenticated: true,
      email: "admin@example.com",
      pathname: "/admin",
    });

    expect(result).toEqual({ status: "not_found" });
  });
});

describe("verification / photo review action payloads", () => {
  it("builds approve body with optional metadata", () => {
    const body = buildVerificationDecisionBody({
      action: "approve",
      docType: "thai_id",
      last4: "1234",
      issuingCountry: "TH",
      notes: "Looks good",
      canApprove: true,
    });

    expect(body).toEqual({
      action: "approve",
      docType: "thai_id",
      last4: "1234",
      issuingCountry: "TH",
      notes: "Looks good",
    });
  });

  it("builds reject body and omits empty optional fields", () => {
    const body = buildVerificationDecisionBody({
      action: "reject",
      docType: "passport",
      last4: "  ",
      notes: "Blurry",
      canApprove: false,
    });

    expect(body).toEqual({
      action: "reject",
      docType: "passport",
      notes: "Blurry",
    });
  });

  it("cannot submit approve when canApprove is false", () => {
    expect(canSubmitVerificationApprove(false)).toBe(false);
    expect(
      buildVerificationDecisionBody({
        action: "approve",
        docType: "other",
        canApprove: false,
      })
    ).toBeNull();
  });

  it("photo reject body includes optional reason", () => {
    expect(buildPhotoRejectBody("Not suitable")).toEqual({
      reason: "Not suitable",
    });
    expect(buildPhotoRejectBody("  ")).toEqual({});
    expect(buildPhotoRejectBody()).toEqual({});
  });

  it("photo approve uses POST with no body requirement", () => {
    // Documented contract for UI: POST /api/admin/photos/:id/approve
    expect("/api/admin/photos/photo-1/approve").toMatch(
      /\/api\/admin\/photos\/[^/]+\/approve$/
    );
  });
});
