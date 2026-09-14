import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveAdminPageAccess } from "../guard";
import {
  buildPhotoRejectBody,
  buildVerificationDecisionBody,
  canSubmitVerificationApprove,
} from "../review-actions";
import { formatModerationConfidencePercent } from "../format-confidence";

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

describe("formatModerationConfidencePercent", () => {
  it("formats stored integer percent without multiplying by 100", () => {
    expect(formatModerationConfidencePercent(85)).toBe("85%");
    expect(formatModerationConfidencePercent(92)).toBe("92%");
  });

  it("shows em dash for null/undefined confidence", () => {
    expect(formatModerationConfidencePercent(null)).toBe("—");
    expect(formatModerationConfidencePercent(undefined)).toBe("—");
  });
});

describe("verification / photo review action payloads", () => {
  it("builds approve body with optional metadata when explicitly provided", () => {
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

  it("omits blank optional metadata", () => {
    const body = buildVerificationDecisionBody({
      action: "approve",
      docType: "",
      last4: "  ",
      issuingCountry: "",
      notes: "",
      canApprove: true,
    });

    expect(body).toEqual({ action: "approve" });
    expect(body).not.toHaveProperty("docType");
    expect(body).not.toHaveProperty("issuingCountry");
  });

  it("includes explicitly selected docType only", () => {
    const body = buildVerificationDecisionBody({
      action: "approve",
      docType: "passport",
      canApprove: true,
    });

    expect(body).toEqual({
      action: "approve",
      docType: "passport",
    });
  });

  it("includes explicitly entered country only", () => {
    const body = buildVerificationDecisionBody({
      action: "reject",
      issuingCountry: "TH",
      canApprove: false,
    });

    expect(body).toEqual({
      action: "reject",
      issuingCountry: "TH",
    });
  });

  it("reject with untouched fields does not contain guessed Thai metadata", () => {
    const body = buildVerificationDecisionBody({
      action: "reject",
      canApprove: false,
    });

    expect(body).toEqual({ action: "reject" });
    expect(body).not.toHaveProperty("docType");
    expect(body).not.toHaveProperty("issuingCountry");
    expect(JSON.stringify(body)).not.toContain("thai_id");
    expect(JSON.stringify(body)).not.toContain("TH");
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
});
