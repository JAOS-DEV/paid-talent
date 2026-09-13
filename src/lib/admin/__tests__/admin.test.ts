import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAdminEmailAllowlist,
  isAdminEmail,
} from "../index";

describe("admin helpers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getAdminEmailAllowlist", () => {
    it("should return empty array when ADMIN_EMAILS is not set", () => {
      delete process.env.ADMIN_EMAILS;
      const result = getAdminEmailAllowlist();
      expect(result).toEqual([]);
    });

    it("should parse single email", () => {
      process.env.ADMIN_EMAILS = "admin@example.com";
      const result = getAdminEmailAllowlist();
      expect(result).toEqual(["admin@example.com"]);
    });

    it("should parse multiple comma-separated emails", () => {
      process.env.ADMIN_EMAILS = "admin1@example.com,admin2@example.com";
      const result = getAdminEmailAllowlist();
      expect(result).toEqual(["admin1@example.com", "admin2@example.com"]);
    });

    it("should trim whitespace from emails", () => {
      process.env.ADMIN_EMAILS = " admin1@example.com , admin2@example.com ";
      const result = getAdminEmailAllowlist();
      expect(result).toEqual(["admin1@example.com", "admin2@example.com"]);
    });

    it("should lowercase all emails", () => {
      process.env.ADMIN_EMAILS = "Admin@Example.COM";
      const result = getAdminEmailAllowlist();
      expect(result).toEqual(["admin@example.com"]);
    });

    it("should filter out empty entries", () => {
      process.env.ADMIN_EMAILS = "admin@example.com,,another@example.com,";
      const result = getAdminEmailAllowlist();
      expect(result).toEqual(["admin@example.com", "another@example.com"]);
    });
  });

  describe("isAdminEmail", () => {
    it("should return no_email reason for null email", () => {
      process.env.ADMIN_EMAILS = "admin@example.com";
      const result = isAdminEmail(null);
      expect(result.isAdmin).toBe(false);
      expect(result.email).toBeNull();
      expect(result.reason).toBe("no_email");
    });

    it("should return no_email reason for undefined email", () => {
      process.env.ADMIN_EMAILS = "admin@example.com";
      const result = isAdminEmail(undefined);
      expect(result.isAdmin).toBe(false);
      expect(result.email).toBeNull();
      expect(result.reason).toBe("no_email");
    });

    it("should return no_allowlist reason when no allowlist configured", () => {
      delete process.env.ADMIN_EMAILS;
      const result = isAdminEmail("admin@example.com");
      expect(result.isAdmin).toBe(false);
      expect(result.email).toBe("admin@example.com");
      expect(result.reason).toBe("no_allowlist");
    });

    it("should return authorized for email in allowlist", () => {
      process.env.ADMIN_EMAILS = "admin@example.com,hr@company.com";
      const result = isAdminEmail("admin@example.com");
      expect(result.isAdmin).toBe(true);
      expect(result.email).toBe("admin@example.com");
      expect(result.reason).toBe("authorized");
    });

    it("should return not_in_allowlist for email not in allowlist", () => {
      process.env.ADMIN_EMAILS = "admin@example.com";
      const result = isAdminEmail("user@example.com");
      expect(result.isAdmin).toBe(false);
      expect(result.email).toBe("user@example.com");
      expect(result.reason).toBe("not_in_allowlist");
    });

    it("should be case-insensitive when checking email", () => {
      process.env.ADMIN_EMAILS = "admin@example.com";
      const result = isAdminEmail("ADMIN@EXAMPLE.COM");
      expect(result.isAdmin).toBe(true);
      expect(result.email).toBe("admin@example.com");
    });

    it("should trim whitespace from input email", () => {
      process.env.ADMIN_EMAILS = "admin@example.com";
      const result = isAdminEmail("  admin@example.com  ");
      expect(result.isAdmin).toBe(true);
    });
  });
});
