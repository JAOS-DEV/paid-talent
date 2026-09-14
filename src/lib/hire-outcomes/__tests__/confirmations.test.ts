import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  canRequestConfirmation,
  canRespondToConfirmation,
  getRequestedStatusForConfirmedStatus,
  getRecruiterRequestAction,
  getRecruiterPendingLabel,
  getRecruiterRejectionLabel,
  getRecruiterRequestButtonLabel,
  getWorkerConfirmationCopy,
  isPendingRequestCompatible,
  confirmationDoesNotTouchAvailability,
  WORKER_AVAILABILITY_FIELDS,
  resolveVenueName,
  resolveOpeningContext,
  pickLatestConfirmationRequest,
  buildConfirmationWritePlan,
} from "../confirmations";
import { countConfirmedOutcomeStats, getEffectiveStatus } from "../index";

const recruiterInterest = { recruiterUserId: "recruiter-1" };
const workerInterest = { workerProfileId: "profile-1" };
const workerProfile = { id: "profile-1", userId: "worker-1" };

describe("two-sided hire confirmation", () => {
  describe("request hire", () => {
    it("allows a recruiter to request hire from interested", () => {
      const result = canRequestConfirmation(
        "recruiter-1",
        "recruiter",
        recruiterInterest,
        "interested",
        "hired",
        false
      );
      expect(result.allowed).toBe(true);
    });

    it("does not treat a hire request as a confirmed hired outcome", () => {
      expect(getEffectiveStatus(null)).toBe("interested");
      expect(getRequestedStatusForConfirmedStatus("interested")).toBe("hired");
    });

    it("denies a duplicate pending hire request", () => {
      const result = canRequestConfirmation(
        "recruiter-1",
        "recruiter",
        recruiterInterest,
        "interested",
        "hired",
        true
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("pending_exists");
    });

    it("does not allow requesting start from interested", () => {
      const result = canRequestConfirmation(
        "recruiter-1",
        "recruiter",
        recruiterInterest,
        "interested",
        "started",
        false
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("invalid_transition");
    });
  });

  describe("worker hire response", () => {
    it("allows the owning worker to confirm interested → hired", () => {
      const result = canRespondToConfirmation(
        "worker-1",
        "worker",
        { requestStatus: "pending", requestedStatus: "hired" },
        workerInterest,
        workerProfile,
        "interested"
      );
      expect(result.allowed).toBe(true);
    });

    it("leaves confirmed status interested when hire is rejected", () => {
      const plan = buildConfirmationWritePlan(
        "reject",
        "hired",
        null,
        null,
        "worker-1",
        new Date("2026-01-01")
      );
      expect(plan.hireOutcome).toBeNull();
      expect(plan.requestUpdate.requestStatus).toBe("rejected");
    });

    it("sets hiredAt at confirmation time, not request time", () => {
      const confirmedAt = new Date("2026-03-15T12:00:00.000Z");
      const plan = buildConfirmationWritePlan(
        "confirm",
        "hired",
        null,
        null,
        "worker-1",
        confirmedAt
      );
      expect(plan.hireOutcome).toEqual({
        status: "hired",
        hiredAt: confirmedAt,
        startedAt: null,
      });
    });
  });

  describe("request start", () => {
    it("allows a recruiter to request start after confirmed hired", () => {
      const result = canRequestConfirmation(
        "recruiter-1",
        "recruiter",
        recruiterInterest,
        "hired",
        "started",
        false
      );
      expect(result.allowed).toBe(true);
    });

    it("does not treat a start request as a confirmed started outcome", () => {
      expect(getRequestedStatusForConfirmedStatus("hired")).toBe("started");
      expect(isPendingRequestCompatible("hired", "started")).toBe(true);
      expect(countConfirmedOutcomeStats(["hired"]).started).toBe(0);
    });
  });

  describe("worker start response", () => {
    it("confirms hired → started and preserves hiredAt", () => {
      const hiredAt = new Date("2026-02-01");
      const confirmedAt = new Date("2026-02-10");
      const plan = buildConfirmationWritePlan(
        "confirm",
        "started",
        hiredAt,
        null,
        "worker-1",
        confirmedAt
      );
      expect(plan.hireOutcome).toEqual({
        status: "started",
        hiredAt,
        startedAt: confirmedAt,
      });
    });

    it("leaves confirmed hired and null startedAt when start is rejected", () => {
      const hiredAt = new Date("2026-02-01");
      const plan = buildConfirmationWritePlan(
        "reject",
        "started",
        hiredAt,
        null,
        "worker-1",
        new Date("2026-02-10")
      );
      expect(plan.hireOutcome).toBeNull();
      expect(plan.requestUpdate.requestStatus).toBe("rejected");
    });

    it("cannot request or confirm further once started", () => {
      expect(getRequestedStatusForConfirmedStatus("started")).toBeNull();
      expect(
        canRequestConfirmation(
          "recruiter-1",
          "recruiter",
          recruiterInterest,
          "started",
          "started",
          false
        ).allowed
      ).toBe(false);
      expect(
        canRespondToConfirmation(
          "worker-1",
          "worker",
          { requestStatus: "pending", requestedStatus: "started" },
          workerInterest,
          workerProfile,
          "started"
        ).reason
      ).toBe("invalid_transition");
    });
  });

  describe("security", () => {
    it("denies unauthenticated recruiter requests", () => {
      expect(
        canRequestConfirmation(
          null,
          "recruiter",
          recruiterInterest,
          "interested",
          "hired",
          false
        ).reason
      ).toBe("unauthenticated");
    });

    it("denies a worker creating a recruiter request", () => {
      expect(
        canRequestConfirmation(
          "worker-1",
          "worker",
          recruiterInterest,
          "interested",
          "hired",
          false
        ).reason
      ).toBe("wrong_role");
    });

    it("denies a recruiter requesting against another recruiter's interest", () => {
      expect(
        canRequestConfirmation(
          "recruiter-2",
          "recruiter",
          recruiterInterest,
          "interested",
          "hired",
          false
        ).reason
      ).toBe("not_owner");
    });

    it("denies unauthenticated confirmation", () => {
      expect(
        canRespondToConfirmation(
          null,
          "worker",
          { requestStatus: "pending", requestedStatus: "hired" },
          workerInterest,
          workerProfile,
          "interested"
        ).reason
      ).toBe("unauthenticated");
    });

    it("denies a recruiter confirming a worker request", () => {
      expect(
        canRespondToConfirmation(
          "recruiter-1",
          "recruiter",
          { requestStatus: "pending", requestedStatus: "hired" },
          workerInterest,
          workerProfile,
          "interested"
        ).reason
      ).toBe("wrong_role");
    });

    it("denies worker A confirming worker B's request", () => {
      expect(
        canRespondToConfirmation(
          "worker-2",
          "worker",
          { requestStatus: "pending", requestedStatus: "hired" },
          workerInterest,
          workerProfile,
          "interested"
        ).reason
      ).toBe("not_owner");
    });

    it("treats request id alone as insufficient authorization", () => {
      expect(
        canRespondToConfirmation(
          "worker-2",
          "worker",
          { requestStatus: "pending", requestedStatus: "hired" },
          workerInterest,
          workerProfile,
          "interested"
        ).allowed
      ).toBe(false);
    });

    it("rejects already confirmed or rejected requests", () => {
      expect(
        canRespondToConfirmation(
          "worker-1",
          "worker",
          { requestStatus: "confirmed", requestedStatus: "hired" },
          workerInterest,
          workerProfile,
          "interested"
        ).reason
      ).toBe("not_pending");
      expect(
        canRespondToConfirmation(
          "worker-1",
          "worker",
          { requestStatus: "rejected", requestedStatus: "hired" },
          workerInterest,
          workerProfile,
          "interested"
        ).reason
      ).toBe("not_pending");
    });
  });

  describe("stats use confirmed hire_outcomes only", () => {
    it("does not count a pending hire as hired", () => {
      expect(countConfirmedOutcomeStats(["interested"]).hired).toBe(0);
    });

    it("does not count a rejected hire as hired", () => {
      expect(countConfirmedOutcomeStats(["interested"]).hired).toBe(0);
    });

    it("counts a confirmed hire as hired", () => {
      expect(countConfirmedOutcomeStats(["hired"]).hired).toBe(1);
    });

    it("counts a pending start as hired, not started", () => {
      const stats = countConfirmedOutcomeStats(["hired"]);
      expect(stats.hired).toBe(1);
      expect(stats.started).toBe(0);
    });

    it("counts a confirmed start as started", () => {
      expect(countConfirmedOutcomeStats(["started"]).started).toBe(1);
    });
  });

  describe("availability is untouched", () => {
    it("never includes worker availability fields in confirmation writes", () => {
      const confirmHire = buildConfirmationWritePlan(
        "confirm",
        "hired",
        null,
        null,
        "worker-1",
        new Date()
      );
      const confirmStart = buildConfirmationWritePlan(
        "confirm",
        "started",
        new Date(),
        null,
        "worker-1",
        new Date()
      );
      expect(confirmHire.workerProfileUpdate).toBeNull();
      expect(confirmStart.workerProfileUpdate).toBeNull();
      expect(confirmationDoesNotTouchAvailability()).toBe(true);
      expect(WORKER_AVAILABILITY_FIELDS).toEqual(["isPublished", "availability"]);
    });

    it("service and worker actions do not write publication or availability", () => {
      const serviceSrc = readFileSync(
        join(__dirname, "../service.ts"),
        "utf8"
      );
      const workerActionsSrc = readFileSync(
        join(__dirname, "../../../app/worker/hire-confirmation-actions.ts"),
        "utf8"
      );
      expect(serviceSrc).not.toMatch(/isPublished/);
      expect(serviceSrc).not.toMatch(/availability/);
      expect(workerActionsSrc).not.toMatch(/isPublished/);
      expect(workerActionsSrc).not.toMatch(/availability/);
    });
  });

  describe("legacy confirmed rows", () => {
    it("treats existing hired and started rows as already confirmed", () => {
      const hired = {
        id: "legacy-hired",
        status: "hired" as const,
        interestId: "i1",
        hiredAt: new Date("2025-01-01"),
        startedAt: null,
        notes: null,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
      };
      const started = {
        ...hired,
        id: "legacy-started",
        status: "started" as const,
        startedAt: new Date("2025-01-15"),
      };
      expect(getEffectiveStatus(hired)).toBe("hired");
      expect(getEffectiveStatus(started)).toBe("started");
      expect(getRecruiterRequestAction("hired", null)).toBe("request-start");
      expect(getRecruiterRequestAction("started", null)).toBeNull();
    });
  });

  describe("concurrency helpers", () => {
    it("picks the pending request over older history", () => {
      const latest = pickLatestConfirmationRequest([
        {
          requestStatus: "rejected" as const,
          requestedAt: "2026-01-02",
        },
        {
          requestStatus: "pending" as const,
          requestedAt: "2026-01-01",
        },
      ]);
      expect(latest?.requestStatus).toBe("pending");
    });
  });

  describe("recruiter and worker copy", () => {
    it("uses request language instead of mark hired/started", () => {
      expect(getRecruiterRequestButtonLabel("request-hire")).toBe(
        "Request hire confirmation"
      );
      expect(getRecruiterRequestButtonLabel("request-start")).toBe(
        "Request start confirmation"
      );
      expect(getRecruiterPendingLabel("hired")).toBe(
        "Awaiting talent confirmation"
      );
      expect(getRecruiterPendingLabel("started")).toBe(
        "Awaiting start confirmation"
      );
      expect(getRecruiterRejectionLabel("hired")).toBe(
        "Talent did not confirm the hire"
      );
      expect(getRecruiterRejectionLabel("started")).toBe(
        "Talent did not confirm they have started"
      );
    });

    it("builds worker hire and start card copy", () => {
      const hire = getWorkerConfirmationCopy("Sky Bar", "hired");
      expect(hire.heading).toBe("Action required");
      expect(hire.statement).toContain("Sky Bar");
      expect(hire.confirmLabel).toBe("Confirm hired");
      expect(hire.rejectLabel).toBe("This isn't correct");

      const start = getWorkerConfirmationCopy("Sky Bar", "started");
      expect(start.statement).toContain("started working");
      expect(start.confirmLabel).toBe("Confirm started");
    });

    it("resolves venue and opening context without internal ids", () => {
      expect(resolveVenueName("Sky Bar", "Jane")).toBe("Sky Bar");
      expect(resolveVenueName(null, "Jane")).toBe("Jane");
      expect(resolveVenueName(null, null)).toBe("A venue");
      expect(resolveOpeningContext("Bartender", "Central Pattaya")).toBe(
        "Bartender — Central Pattaya"
      );
    });
  });
});

describe("no recruiter bypass to confirmed hired/started", () => {
  it("removes mark-hired and mark-started recruiter routes", () => {
    const markHired = join(
      __dirname,
      "../../../app/api/recruiter/interests/mark-hired/route.ts"
    );
    const markStarted = join(
      __dirname,
      "../../../app/api/recruiter/interests/mark-started/route.ts"
    );
    expect(() => readFileSync(markHired, "utf8")).toThrow();
    expect(() => readFileSync(markStarted, "utf8")).toThrow();
  });

  it("recruiter actions only create confirmation requests", () => {
    const recruiterActions = readFileSync(
      join(__dirname, "../../../app/recruiter/actions.ts"),
      "utf8"
    );
    expect(recruiterActions).toContain("requestConfirmation");
    expect(recruiterActions).not.toMatch(/status:\s*"hired"/);
    expect(recruiterActions).not.toMatch(/status:\s*"started"/);
    expect(recruiterActions).not.toContain("markAsHired");
    expect(recruiterActions).not.toContain("markAsStarted");
  });
});
