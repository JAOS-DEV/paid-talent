import { describe, it, expect } from "vitest";
import {
  getStatusLabel,
  getStatusVariant,
} from "../HireOutcomeStatusBadge";
import { getNextActionLabel } from "../HireOutcomeActions";

describe("HireOutcomeStatusBadge helpers", () => {
  describe("getStatusLabel", () => {
    it("returns 'Interested' for interested status", () => {
      expect(getStatusLabel("interested")).toBe("Interested");
    });

    it("returns 'Hired' for hired status", () => {
      expect(getStatusLabel("hired")).toBe("Hired");
    });

    it("returns 'Started' for started status", () => {
      expect(getStatusLabel("started")).toBe("Started");
    });
  });

  describe("getStatusVariant", () => {
    it("returns 'primary' variant for interested status", () => {
      expect(getStatusVariant("interested")).toBe("primary");
    });

    it("returns 'gold' variant for hired status", () => {
      expect(getStatusVariant("hired")).toBe("gold");
    });

    it("returns 'success' variant for started status", () => {
      expect(getStatusVariant("started")).toBe("success");
    });
  });
});

describe("HireOutcomeActions helpers", () => {
  describe("getNextActionLabel", () => {
    it("returns 'Mark Hired' when current status is interested", () => {
      expect(getNextActionLabel("interested")).toBe("Mark Hired");
    });

    it("returns 'Mark Started' when current status is hired", () => {
      expect(getNextActionLabel("hired")).toBe("Mark Started");
    });

    it("returns null when current status is started (terminal)", () => {
      expect(getNextActionLabel("started")).toBeNull();
    });
  });
});
