import { describe, expect, it } from "vitest";
import {
  canonicalizePayPeriod,
  formatOpeningChoiceLabel,
  formatOpeningPay,
  getOpeningPayAmount,
  hasLegacyPayRange,
  joinOpeningContextAndPay,
  parseStoredPayPeriod,
  serializeCustomPayPeriod,
  toOpeningPayStorage,
} from "../opening-pay";

describe("opening pay helpers", () => {
  describe("getOpeningPayAmount and legacy ranges", () => {
    it("uses payMin-only as the single amount", () => {
      expect(getOpeningPayAmount({ payMin: 1200, payMax: null })).toBe(1200);
      expect(hasLegacyPayRange({ payMin: 1200, payMax: null })).toBe(false);
    });

    it("uses payMax-only as the single amount", () => {
      expect(getOpeningPayAmount({ payMin: null, payMax: 900 })).toBe(900);
      expect(hasLegacyPayRange({ payMin: null, payMax: 900 })).toBe(false);
    });

    it("uses equal min/max as the single amount", () => {
      expect(getOpeningPayAmount({ payMin: 800, payMax: 800 })).toBe(800);
      expect(hasLegacyPayRange({ payMin: 800, payMax: 800 })).toBe(false);
    });

    it("does not average an unequal legacy range", () => {
      const opening = { payMin: 500, payMax: 1000 };
      expect(hasLegacyPayRange(opening)).toBe(true);
      expect(getOpeningPayAmount(opening)).toBeNull();
    });
  });

  describe("toOpeningPayStorage", () => {
    it("stores a single advertised amount in payMin and clears payMax", () => {
      expect(toOpeningPayStorage(1200)).toEqual({ payMin: 1200, payMax: null });
      expect(toOpeningPayStorage(null)).toEqual({ payMin: null, payMax: null });
    });
  });

  describe("pay period canonicalization", () => {
    it("accepts presets", () => {
      expect(canonicalizePayPeriod("night")).toBe("night");
      expect(canonicalizePayPeriod("day")).toBe("day");
      expect(canonicalizePayPeriod("week")).toBe("week");
      expect(canonicalizePayPeriod("month")).toBe("month");
      expect(canonicalizePayPeriod("engagement")).toBe("engagement");
    });

    it("accepts useful custom periods", () => {
      expect(canonicalizePayPeriod("10 days")).toBe("10 days");
      expect(canonicalizePayPeriod("15 days")).toBe("15 days");
      expect(canonicalizePayPeriod("1 month")).toBe("1 month");
      expect(canonicalizePayPeriod("6 weeks")).toBe("6 weeks");
      expect(canonicalizePayPeriod("1 months")).toBe("1 month");
    });

    it("rejects malformed or arbitrary text", () => {
      expect(canonicalizePayPeriod("<script>alert(1)</script>")).toBeNull();
      expect(canonicalizePayPeriod("call me on LINE")).toBeNull();
      expect(canonicalizePayPeriod("forever")).toBeNull();
      expect(canonicalizePayPeriod("366 days")).toBeNull();
      expect(canonicalizePayPeriod("53 weeks")).toBeNull();
      expect(canonicalizePayPeriod("25 months")).toBeNull();
      expect(canonicalizePayPeriod("0 days")).toBeNull();
    });

    it("parses stored custom values back into controls", () => {
      expect(parseStoredPayPeriod("15 days")).toEqual({
        kind: "custom",
        duration: 15,
        unit: "days",
      });
      expect(parseStoredPayPeriod("1 month")).toEqual({
        kind: "custom",
        duration: 1,
        unit: "months",
      });
      expect(parseStoredPayPeriod("night")).toEqual({
        kind: "preset",
        value: "night",
      });
      expect(serializeCustomPayPeriod(10, "days")).toBe("10 days");
    });
  });

  describe("formatOpeningPay", () => {
    it("formats a single advertised amount without From/Up to", () => {
      expect(
        formatOpeningPay({
          payMin: 1200,
          payMax: null,
          payCurrency: "THB",
          payPeriod: "night",
        })
      ).toBe("฿1,200 / night");
    });

    it("formats custom 15 days and engagement wording", () => {
      expect(
        formatOpeningPay({
          payMin: 12000,
          payMax: null,
          payCurrency: "THB",
          payPeriod: "15 days",
        })
      ).toBe("฿12,000 / 15 days");
      expect(
        formatOpeningPay({
          payMin: 15000,
          payMax: null,
          payCurrency: "THB",
          payPeriod: "engagement",
        })
      ).toBe("฿15,000 for engagement");
    });

    it("formats USD custom periods", () => {
      expect(
        formatOpeningPay({
          payMin: 18000,
          payMax: null,
          payCurrency: "USD",
          payPeriod: "15 days",
        })
      ).toBe("$18,000 / 15 days");
    });

    it("keeps unequal legacy ranges until they are edited", () => {
      expect(
        formatOpeningPay({
          payMin: 500,
          payMax: 1000,
          payCurrency: "THB",
          payPeriod: "night",
        })
      ).toBe("฿500 – 1,000 / night");
    });

    it("formats payMin-only and payMax-only without From/Up to", () => {
      expect(
        formatOpeningPay({ payMin: 1200, payMax: null, payPeriod: "week" })
      ).toBe("฿1,200 / week");
      expect(
        formatOpeningPay({ payMin: null, payMax: 900, payPeriod: "month" })
      ).toBe("฿900 / month");
    });

    it("returns null when no pay is set", () => {
      expect(formatOpeningPay({ payMin: null, payMax: null })).toBeNull();
    });
  });

  describe("opening labels", () => {
    it("appends formatted pay to role and area", () => {
      expect(
        formatOpeningChoiceLabel({
          role: "Bartender",
          area: "Sukhumvit",
          payMin: 1200,
          payMax: null,
          payCurrency: "THB",
          payPeriod: "night",
        })
      ).toBe("Bartender — Sukhumvit · ฿1,200 / night");
    });

    it("joins opening context and pay", () => {
      expect(
        joinOpeningContextAndPay("Bartender — Sukhumvit", "฿1,200 / night")
      ).toBe("Bartender — Sukhumvit · ฿1,200 / night");
    });
  });
});
