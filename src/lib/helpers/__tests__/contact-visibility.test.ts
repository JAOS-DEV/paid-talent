import { describe, it, expect } from "vitest";
import {
  hasActiveSubscription,
  hasTopTalentPlan,
  canAccessTopTalentContact,
  determineContactVisibility,
  getVisibleContactFields,
  maskContactField,
  type SubscriptionInfo,
} from "../contact-visibility";

describe("contact-visibility helpers", () => {
  describe("hasActiveSubscription", () => {
    it("should return false for null subscription", () => {
      expect(hasActiveSubscription(null)).toBe(false);
    });

    it("should return true for active subscription", () => {
      const sub: SubscriptionInfo = { status: "active", plan: "free" };
      expect(hasActiveSubscription(sub)).toBe(true);
    });

    it("should return true for trialing subscription", () => {
      const sub: SubscriptionInfo = { status: "trialing", plan: "free" };
      expect(hasActiveSubscription(sub)).toBe(true);
    });

    it("should return false for canceled subscription", () => {
      const sub: SubscriptionInfo = { status: "canceled", plan: "free" };
      expect(hasActiveSubscription(sub)).toBe(false);
    });

    it("should return false for past_due subscription", () => {
      const sub: SubscriptionInfo = { status: "past_due", plan: "free" };
      expect(hasActiveSubscription(sub)).toBe(false);
    });

    it("should return false for incomplete subscription", () => {
      const sub: SubscriptionInfo = { status: "incomplete", plan: "free" };
      expect(hasActiveSubscription(sub)).toBe(false);
    });
  });

  describe("hasTopTalentPlan", () => {
    it("should return false for null subscription", () => {
      expect(hasTopTalentPlan(null)).toBe(false);
    });

    it("should return true for top_talent_unlock plan", () => {
      const sub: SubscriptionInfo = { status: "active", plan: "top_talent_unlock" };
      expect(hasTopTalentPlan(sub)).toBe(true);
    });

    it("should return false for free plan", () => {
      const sub: SubscriptionInfo = { status: "active", plan: "free" };
      expect(hasTopTalentPlan(sub)).toBe(false);
    });
  });

  describe("canAccessTopTalentContact", () => {
    it("should return false for null subscription", () => {
      expect(canAccessTopTalentContact(null)).toBe(false);
    });

    it("should return true for active top_talent_unlock", () => {
      const sub: SubscriptionInfo = { status: "active", plan: "top_talent_unlock" };
      expect(canAccessTopTalentContact(sub)).toBe(true);
    });

    it("should return true for trialing top_talent_unlock", () => {
      const sub: SubscriptionInfo = { status: "trialing", plan: "top_talent_unlock" };
      expect(canAccessTopTalentContact(sub)).toBe(true);
    });

    it("should return false for active free plan", () => {
      const sub: SubscriptionInfo = { status: "active", plan: "free" };
      expect(canAccessTopTalentContact(sub)).toBe(false);
    });

    it("should return false for canceled top_talent_unlock", () => {
      const sub: SubscriptionInfo = { status: "canceled", plan: "top_talent_unlock" };
      expect(canAccessTopTalentContact(sub)).toBe(false);
    });

    it("should return false for past_due top_talent_unlock", () => {
      const sub: SubscriptionInfo = { status: "past_due", plan: "top_talent_unlock" };
      expect(canAccessTopTalentContact(sub)).toBe(false);
    });
  });

  describe("determineContactVisibility", () => {
    it("should allow viewing non-Top Talent contacts without subscription", () => {
      const result = determineContactVisibility(false, null);
      expect(result).toEqual({
        canViewContact: true,
        reason: "not_top_talent",
      });
    });

    it("should allow viewing non-Top Talent contacts with any subscription", () => {
      const sub: SubscriptionInfo = { status: "canceled", plan: "free" };
      const result = determineContactVisibility(false, sub);
      expect(result).toEqual({
        canViewContact: true,
        reason: "not_top_talent",
      });
    });

    it("should require subscription for Top Talent contacts", () => {
      const result = determineContactVisibility(true, null);
      expect(result).toEqual({
        canViewContact: false,
        reason: "subscription_required",
      });
    });

    it("should allow viewing Top Talent with valid subscription", () => {
      const sub: SubscriptionInfo = { status: "active", plan: "top_talent_unlock" };
      const result = determineContactVisibility(true, sub);
      expect(result).toEqual({
        canViewContact: true,
        reason: "has_subscription",
      });
    });

    it("should deny Top Talent view with free active subscription", () => {
      const sub: SubscriptionInfo = { status: "active", plan: "free" };
      const result = determineContactVisibility(true, sub);
      expect(result).toEqual({
        canViewContact: false,
        reason: "subscription_required",
      });
    });

    it("should deny Top Talent view with canceled top_talent subscription", () => {
      const sub: SubscriptionInfo = { status: "canceled", plan: "top_talent_unlock" };
      const result = determineContactVisibility(true, sub);
      expect(result).toEqual({
        canViewContact: false,
        reason: "subscription_required",
      });
    });
  });

  describe("getVisibleContactFields", () => {
    it("should return all fields for non-Top Talent", () => {
      const fields = getVisibleContactFields(false, null);
      expect(fields).toEqual(["lineId", "whatsappNumber", "phoneNumber", "contactEmail"]);
    });

    it("should return all fields for Top Talent with valid subscription", () => {
      const sub: SubscriptionInfo = { status: "active", plan: "top_talent_unlock" };
      const fields = getVisibleContactFields(true, sub);
      expect(fields).toEqual(["lineId", "whatsappNumber", "phoneNumber", "contactEmail"]);
    });

    it("should return empty array for Top Talent without subscription", () => {
      const fields = getVisibleContactFields(true, null);
      expect(fields).toEqual([]);
    });

    it("should return empty array for Top Talent with wrong subscription", () => {
      const sub: SubscriptionInfo = { status: "active", plan: "free" };
      const fields = getVisibleContactFields(true, sub);
      expect(fields).toEqual([]);
    });
  });

  describe("maskContactField", () => {
    it("should return null for null input", () => {
      expect(maskContactField(null, true)).toBeNull();
      expect(maskContactField(null, false)).toBeNull();
    });

    it("should return unmasked value when visible", () => {
      expect(maskContactField("+1234567890", true)).toBe("+1234567890");
    });

    it("should mask value when not visible", () => {
      expect(maskContactField("+1234567890", false)).toBe("+1****90");
    });

    it("should return **** for short values when masked", () => {
      expect(maskContactField("1234", false)).toBe("****");
    });

    it("should handle empty string as masked", () => {
      expect(maskContactField("", false)).toBeNull();
    });

    it("should mask LINE ID correctly", () => {
      expect(maskContactField("my_line_id_123", false)).toBe("my****23");
    });

    it("should mask email correctly", () => {
      expect(maskContactField("user@example.com", false)).toBe("us****om");
    });
  });
});
