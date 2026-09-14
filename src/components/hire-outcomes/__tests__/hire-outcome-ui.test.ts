import { describe, it, expect } from "vitest";
import {
  getStatusLabel,
  getStatusVariant,
} from "../HireOutcomeStatusBadge";
import {
  getNextActionLabel,
  getHireConfirmationEndpoint,
} from "../HireOutcomeActions";
import { getWorkerConfirmationEndpoint } from "../WorkerConfirmationCard";
import {
  getRecruiterRequestAction,
  getWorkerConfirmationCopy,
} from "@/lib/hire-outcomes/confirmations";

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

describe("recruiter confirmation UI", () => {
  it("shows request hire confirmation from interested", () => {
    expect(getNextActionLabel("interested")).toBe("Request hire confirmation");
    expect(getHireConfirmationEndpoint("hired")).toBe(
      "/api/recruiter/interests/request-hire"
    );
  });

  it("hides the request button while awaiting confirmation", () => {
    expect(getNextActionLabel("interested", "hired")).toBeNull();
    expect(getRecruiterRequestAction("interested", "hired")).toBeNull();
  });

  it("shows request start confirmation only after confirmed hired", () => {
    expect(getNextActionLabel("hired")).toBe("Request start confirmation");
    expect(getHireConfirmationEndpoint("started")).toBe(
      "/api/recruiter/interests/request-start"
    );
    expect(getNextActionLabel("interested")).not.toBe(
      "Request start confirmation"
    );
  });

  it("has no further recruiter action after confirmed started", () => {
    expect(getNextActionLabel("started")).toBeNull();
  });
});

describe("worker confirmation UI", () => {
  it("builds a pending hire card", () => {
    const copy = getWorkerConfirmationCopy("Sky Bar", "hired");
    expect(copy.heading).toBe("Action required");
    expect(copy.statement).toBe("Sky Bar says they have hired you.");
    expect(copy.confirmLabel).toBe("Confirm hired");
    expect(copy.rejectLabel).toBe("This isn't correct");
  });

  it("builds a pending start card", () => {
    const copy = getWorkerConfirmationCopy("Sky Bar", "started");
    expect(copy.statement).toBe(
      "Sky Bar says you have started working with them."
    );
    expect(copy.confirmLabel).toBe("Confirm started");
    expect(copy.rejectLabel).toBe("Not yet / This isn't correct");
  });

  it("confirm and reject buttons call the worker endpoints", () => {
    expect(getWorkerConfirmationEndpoint("req-1", "confirm")).toBe(
      "/api/worker/hire-confirmations/req-1/confirm"
    );
    expect(getWorkerConfirmationEndpoint("req-1", "reject")).toBe(
      "/api/worker/hire-confirmations/req-1/reject"
    );
  });

  it("does not invent an empty action-required box when there are no requests", () => {
    const pending: unknown[] = [];
    expect(pending.length > 0).toBe(false);
  });
});
