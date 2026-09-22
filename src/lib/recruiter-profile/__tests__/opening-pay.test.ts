import { describe, expect, it } from "vitest";
import {
  canonicalizePayPeriod,
  formatOpeningChoiceLabel,
  formatOpeningPay,
  getOpeningPayAmount,
  hasLegacyPayRange,
  joinOpeningContextAndPay,
  OPENING_PAY_PERIOD_PRESETS,
  parseStoredPayPeriod,
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

  describe("pay period presets", () => {
    it("only supports night, hour, shift", () => {
      expect(OPENING_PAY_PERIOD_PRESETS).toEqual(["night", "hour", "shift"]);
    });

    it("accepts the three preset values", () => {
      expect(canonicalizePayPeriod("night")).toBe("night");
      expect(canonicalizePayPeriod("hour")).toBe("hour");
      expect(canonicalizePayPeriod("shift")).toBe("shift");
    });

    it("rejects other values including old presets", () => {
      expect(canonicalizePayPeriod("day")).toBeNull();
      expect(canonicalizePayPeriod("week")).toBeNull();
      expect(canonicalizePayPeriod("month")).toBeNull();
      expect(canonicalizePayPeriod("engagement")).toBeNull();
      expect(canonicalizePayPeriod("15 days")).toBeNull();
      expect(canonicalizePayPeriod("<script>alert(1)</script>")).toBeNull();
      expect(canonicalizePayPeriod("call me on LINE")).toBeNull();
    });

    it("parses stored preset values", () => {
      expect(parseStoredPayPeriod("night")).toEqual({
        kind: "preset",
        value: "night",
      });
      expect(parseStoredPayPeriod("hour")).toEqual({
        kind: "preset",
        value: "hour",
      });
      expect(parseStoredPayPeriod("shift")).toEqual({
        kind: "preset",
        value: "shift",
      });
    });

    it("returns invalid for unsupported stored values", () => {
      expect(parseStoredPayPeriod("15 days")).toEqual({ kind: "invalid" });
      expect(parseStoredPayPeriod("week")).toEqual({ kind: "invalid" });
    });
  });

  describe("formatOpeningPay", () => {
    it("formats a single amount with currency symbol and period", () => {
      expect(
        formatOpeningPay({
          payMin: 1200,
          payMax: null,
          payCurrency: "THB",
          payPeriod: "night",
        })
      ).toBe("฿1,200 / night");
    });

    it("formats hour and shift periods", () => {
      expect(
        formatOpeningPay({
          payMin: 350,
          payMax: null,
          payCurrency: "THB",
          payPeriod: "hour",
        })
      ).toBe("฿350 / hour");
      expect(
        formatOpeningPay({
          payMin: 2000,
          payMax: null,
          payCurrency: "THB",
          payPeriod: "shift",
        })
      ).toBe("฿2,000 / shift");
    });

    it("formats USD amounts", () => {
      expect(
        formatOpeningPay({
          payMin: 50,
          payMax: null,
          payCurrency: "USD",
          payPeriod: "hour",
        })
      ).toBe("$50 / hour");
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
