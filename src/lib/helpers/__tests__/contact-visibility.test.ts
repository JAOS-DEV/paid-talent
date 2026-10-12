import { describe, it, expect } from "vitest";
import {
  hasActiveSubscription,
  hasTopTalentPlan,
  canAccessTopTalentContact,
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
});
