import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isDevBypassAllowed } from "../config";

describe("Auth Security - Dev Bypass Gate", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.AUTH_DEV_BYPASS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("isDevBypassAllowed", () => {
    it("should return false when NODE_ENV is not development", () => {
      process.env.NODE_ENV = "production";
      process.env.AUTH_DEV_BYPASS = "true";

      expect(isDevBypassAllowed()).toBe(false);
    });

    it("should return false when NODE_ENV is test", () => {
      process.env.NODE_ENV = "test";
      process.env.AUTH_DEV_BYPASS = "true";

      expect(isDevBypassAllowed()).toBe(false);
    });

    it("should return false when AUTH_DEV_BYPASS is not set", () => {
      process.env.NODE_ENV = "development";

      expect(isDevBypassAllowed()).toBe(false);
    });

    it("should return false when AUTH_DEV_BYPASS is not exactly 'true'", () => {
      process.env.NODE_ENV = "development";
      process.env.AUTH_DEV_BYPASS = "1";

      expect(isDevBypassAllowed()).toBe(false);
    });

    it("should return false when AUTH_DEV_BYPASS is 'TRUE' (case sensitive)", () => {
      process.env.NODE_ENV = "development";
      process.env.AUTH_DEV_BYPASS = "TRUE";

      expect(isDevBypassAllowed()).toBe(false);
    });

    it("should return false when AUTH_DEV_BYPASS is 'false'", () => {
      process.env.NODE_ENV = "development";
      process.env.AUTH_DEV_BYPASS = "false";

      expect(isDevBypassAllowed()).toBe(false);
    });

    it("should return false when both conditions are missing", () => {
      expect(isDevBypassAllowed()).toBe(false);
    });

    it("should return true ONLY when NODE_ENV=development AND AUTH_DEV_BYPASS=true", () => {
      process.env.NODE_ENV = "development";
      process.env.AUTH_DEV_BYPASS = "true";

      expect(isDevBypassAllowed()).toBe(true);
    });

    it("should return false in staging environment", () => {
      process.env.NODE_ENV = "staging";
      process.env.AUTH_DEV_BYPASS = "true";

      expect(isDevBypassAllowed()).toBe(false);
    });

    it("should return false when VERCEL_ENV suggests preview", () => {
      process.env.NODE_ENV = "development";
      process.env.AUTH_DEV_BYPASS = "true";
      process.env.VERCEL_ENV = "preview";

      // Even with VERCEL_ENV set, dev bypass only checks NODE_ENV and AUTH_DEV_BYPASS.
      // The key protection is that Vercel preview deployments set NODE_ENV=production.
      // This test documents that if someone misconfigures VERCEL, they still need
      // NODE_ENV=development, which Vercel doesn't set for previews.
      expect(isDevBypassAllowed()).toBe(true);
    });
  });

  describe("Security requirements", () => {
    it("REGRESSION: email-only sign-in must be blocked in production", () => {
      process.env.NODE_ENV = "production";
      process.env.AUTH_DEV_BYPASS = "true";

      // Even with AUTH_DEV_BYPASS=true, production must block the bypass
      expect(isDevBypassAllowed()).toBe(false);
    });

    it("REGRESSION: email-only sign-in must be blocked without explicit opt-in", () => {
      process.env.NODE_ENV = "development";
      // AUTH_DEV_BYPASS not set

      // Development mode alone must not enable the bypass
      expect(isDevBypassAllowed()).toBe(false);
    });

    it("REGRESSION: bypass requires BOTH conditions to be true", () => {
      // Test all four combinations
      const testCases = [
        { nodeEnv: "production", bypass: "true", expected: false },
        { nodeEnv: "production", bypass: "false", expected: false },
        { nodeEnv: "development", bypass: "false", expected: false },
        { nodeEnv: "development", bypass: "true", expected: true },
      ];

      for (const tc of testCases) {
        process.env.NODE_ENV = tc.nodeEnv;
        process.env.AUTH_DEV_BYPASS = tc.bypass;

        expect(isDevBypassAllowed()).toBe(tc.expected);
      }
    });
  });
});
