import { describe, it, expect } from "vitest";
import {
  formatTeaserPayBand,
  formatWorkerExpectedPay,
  localizeTeaserPayBand,
  matchesExpectedPayFilter,
  toWorkerExpectedPayStorage,
  getWorkerExpectedPayAmount,
} from "../expected-pay";

describe("expected-pay helpers", () => {
  describe("formatTeaserPayBand", () => {
    it("adds the period without the exact amount", () => {
      expect(formatTeaserPayBand(1499, "THB", "day")).toBe("฿1,000+ / night");
      expect(formatTeaserPayBand(1499, "THB", "month")).toBe("฿1,000+ / month");
      expect(formatTeaserPayBand(15000, "THB", "month")).toBe("฿15,000+ / month");
      expect(formatTeaserPayBand(499, "THB", "night")).toBeNull();
    });

    it("localizes only the period suffix", () => {
      expect(
        localizeTeaserPayBand("฿1,000+ / night", {
          night: "/ คืน",
          month: "/ เดือน",
        })
      ).toBe("฿1,000+ / คืน");
      expect(
        localizeTeaserPayBand("฿1,000+ / month", {
          night: "/ คืน",
          month: "/ เดือน",
        })
      ).toBe("฿1,000+ / เดือน");
    });
  });

  describe("formatWorkerExpectedPay", () => {
    it("formats amount with currency symbol and period", () => {
      expect(
        formatWorkerExpectedPay({
          expectedPayMin: 15000,
          expectedPayPeriod: "day",
          payCurrency: "THB",
        })
      ).toBe("฿15,000 / day");

      expect(
        formatWorkerExpectedPay({
          expectedPayMin: 15000,
          expectedPayPeriod: "month",
          payCurrency: "THB",
        })
      ).toBe("฿15,000 / month");
    });

    it("defaults period to day when amount exists without period", () => {
      expect(
        formatWorkerExpectedPay({
          expectedPayMin: 800,
          payCurrency: "USD",
        })
      ).toBe("$800 / day");
    });

    it("returns null when no amount is set", () => {
      expect(formatWorkerExpectedPay({})).toBeNull();
    });
  });

  describe("toWorkerExpectedPayStorage", () => {
    it("stores amount in min and clears max", () => {
      expect(toWorkerExpectedPayStorage(1200, "day")).toEqual({
        expectedPayMin: 1200,
        expectedPayMax: null,
        expectedPayPeriod: "day",
      });
    });

    it("clears period when amount is null", () => {
      expect(toWorkerExpectedPayStorage(null, "month")).toEqual({
        expectedPayMin: null,
        expectedPayMax: null,
        expectedPayPeriod: null,
      });
    });
  });

  describe("getWorkerExpectedPayAmount", () => {
    it("prefers min and falls back to legacy max", () => {
      expect(getWorkerExpectedPayAmount({ expectedPayMin: 500 })).toBe(500);
      expect(getWorkerExpectedPayAmount({ expectedPayMax: 900 })).toBe(900);
    });
  });

  describe("matchesExpectedPayFilter", () => {
    it("matches within the same period and max amount", () => {
      expect(
        matchesExpectedPayFilter(
          {
            expectedPayMin: 1000,
            expectedPayPeriod: "day",
          },
          { maxPay: 1500, payPeriod: "day" }
        )
      ).toBe(true);
    });

    it("rejects different periods even when amount fits", () => {
      expect(
        matchesExpectedPayFilter(
          {
            expectedPayMin: 1000,
            expectedPayPeriod: "month",
          },
          { maxPay: 1500, payPeriod: "day" }
        )
      ).toBe(false);
    });

    it("rejects amounts above max for the period", () => {
      expect(
        matchesExpectedPayFilter(
          {
            expectedPayMin: 2000,
            expectedPayPeriod: "day",
          },
          { maxPay: 1500, payPeriod: "day" }
        )
      ).toBe(false);
    });
  });
});
