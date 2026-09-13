import { describe, it, expect } from "vitest";
import {
  canTransitionHireOutcomeStatus,
  getHireOutcomeStatusDescription,
  getNextAllowedStatus,
  isTerminalStatus,
  recruiterOwnsInterest,
  canUpdateHireOutcome,
  computeTimestampsForStatusChange,
  filterByHireOutcome,
  hasHireOutcome,
  getEffectiveStatus,
} from "../index";
import type { HireOutcomeStatus } from "@/lib/db/schema";

describe("hire-outcomes helpers", () => {
  describe("canTransitionHireOutcomeStatus", () => {
    it("should not allow same status transition", () => {
      const result = canTransitionHireOutcomeStatus("interested", "interested");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("already");
    });

    it("should allow interested -> hired", () => {
      const result = canTransitionHireOutcomeStatus("interested", "hired");
      expect(result.allowed).toBe(true);
    });

    it("should allow hired -> started", () => {
      const result = canTransitionHireOutcomeStatus("hired", "started");
      expect(result.allowed).toBe(true);
    });

    it("should not allow interested -> started (skip hired)", () => {
      const result = canTransitionHireOutcomeStatus("interested", "started");
      expect(result.allowed).toBe(false);
    });

    it("should not allow started -> interested (backwards)", () => {
      const result = canTransitionHireOutcomeStatus("started", "interested");
      expect(result.allowed).toBe(false);
    });

    it("should not allow started -> hired (backwards)", () => {
      const result = canTransitionHireOutcomeStatus("started", "hired");
      expect(result.allowed).toBe(false);
    });

    it("should not allow hired -> interested (backwards)", () => {
      const result = canTransitionHireOutcomeStatus("hired", "interested");
      expect(result.allowed).toBe(false);
    });
  });

  describe("getHireOutcomeStatusDescription", () => {
    it("should return descriptions for all statuses", () => {
      const statuses: HireOutcomeStatus[] = ["interested", "hired", "started"];
      for (const status of statuses) {
        const desc = getHireOutcomeStatusDescription(status);
        expect(desc).toBeTruthy();
        expect(typeof desc).toBe("string");
      }
    });
  });

  describe("getNextAllowedStatus", () => {
    it("should return hired as next status from interested", () => {
      expect(getNextAllowedStatus("interested")).toBe("hired");
    });

    it("should return started as next status from hired", () => {
      expect(getNextAllowedStatus("hired")).toBe("started");
    });

    it("should return null from started (terminal)", () => {
      expect(getNextAllowedStatus("started")).toBeNull();
    });
  });

  describe("isTerminalStatus", () => {
    it("should return false for interested", () => {
      expect(isTerminalStatus("interested")).toBe(false);
    });

    it("should return false for hired", () => {
      expect(isTerminalStatus("hired")).toBe(false);
    });

    it("should return true for started", () => {
      expect(isTerminalStatus("started")).toBe(true);
    });
  });

  describe("recruiterOwnsInterest", () => {
    it("should return unauthenticated when userId is null", () => {
      const result = recruiterOwnsInterest(null, {
        recruiterUserId: "recruiter-123",
      });
      expect(result.isOwner).toBe(false);
      expect(result.reason).toBe("unauthenticated");
    });

    it("should return unauthenticated when userId is undefined", () => {
      const result = recruiterOwnsInterest(undefined, {
        recruiterUserId: "recruiter-123",
      });
      expect(result.isOwner).toBe(false);
      expect(result.reason).toBe("unauthenticated");
    });

    it("should return not_owner when interest is null", () => {
      const result = recruiterOwnsInterest("user-123", null);
      expect(result.isOwner).toBe(false);
      expect(result.reason).toBe("not_owner");
    });

    it("should return not_owner when recruiterUserId does not match", () => {
      const result = recruiterOwnsInterest("user-123", {
        recruiterUserId: "other-user",
      });
      expect(result.isOwner).toBe(false);
      expect(result.reason).toBe("not_owner");
    });

    it("should return owner when recruiterUserId matches", () => {
      const result = recruiterOwnsInterest("user-123", {
        recruiterUserId: "user-123",
      });
      expect(result.isOwner).toBe(true);
      expect(result.reason).toBe("owner");
    });
  });

  describe("canUpdateHireOutcome", () => {
    it("should return unauthenticated when no userId", () => {
      const result = canUpdateHireOutcome(
        null,
        "recruiter",
        { recruiterUserId: "user-123" },
        "interested",
        "hired"
      );
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("unauthenticated");
    });

    it("should return wrong_role for worker role", () => {
      const result = canUpdateHireOutcome(
        "user-123",
        "worker",
        { recruiterUserId: "user-123" },
        "interested",
        "hired"
      );
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("wrong_role");
    });

    it("should return wrong_role for null role", () => {
      const result = canUpdateHireOutcome(
        "user-123",
        null,
        { recruiterUserId: "user-123" },
        "interested",
        "hired"
      );
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("wrong_role");
    });

    it("should return not_owner when recruiter does not own interest", () => {
      const result = canUpdateHireOutcome(
        "user-123",
        "recruiter",
        { recruiterUserId: "other-user" },
        "interested",
        "hired"
      );
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("not_owner");
    });

    it("should return invalid_transition for disallowed transition", () => {
      const result = canUpdateHireOutcome(
        "user-123",
        "recruiter",
        { recruiterUserId: "user-123" },
        "interested",
        "started"
      );
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("invalid_transition");
    });

    it("should return authorized for valid transition", () => {
      const result = canUpdateHireOutcome(
        "user-123",
        "recruiter",
        { recruiterUserId: "user-123" },
        "interested",
        "hired"
      );
      expect(result.authorized).toBe(true);
      expect(result.reason).toBe("authorized");
    });

    it("should return authorized for hired -> started transition", () => {
      const result = canUpdateHireOutcome(
        "user-123",
        "recruiter",
        { recruiterUserId: "user-123" },
        "hired",
        "started"
      );
      expect(result.authorized).toBe(true);
      expect(result.reason).toBe("authorized");
    });
  });

  describe("computeTimestampsForStatusChange", () => {
    it("should set hiredAt when transitioning to hired", () => {
      const result = computeTimestampsForStatusChange(null, "hired");
      expect(result.hiredAt).toBeInstanceOf(Date);
      expect(result.startedAt).toBeNull();
    });

    it("should set startedAt when transitioning to started", () => {
      const existingOutcome = {
        status: "hired" as const,
        hiredAt: new Date("2024-01-01"),
        startedAt: null,
      };
      const result = computeTimestampsForStatusChange(existingOutcome, "started");
      expect(result.hiredAt).toEqual(new Date("2024-01-01"));
      expect(result.startedAt).toBeInstanceOf(Date);
    });

    it("should preserve existing timestamps for interested status", () => {
      const existingOutcome = {
        status: "hired" as const,
        hiredAt: new Date("2024-01-01"),
        startedAt: null,
      };
      const result = computeTimestampsForStatusChange(existingOutcome, "interested");
      expect(result.hiredAt).toEqual(new Date("2024-01-01"));
      expect(result.startedAt).toBeNull();
    });
  });

  describe("filterByHireOutcome", () => {
    const mockInterests: Parameters<typeof filterByHireOutcome>[0] = [
      {
        interest: { id: "1" } as Parameters<typeof filterByHireOutcome>[0][number]["interest"],
        hireOutcome: null,
      },
      {
        interest: { id: "2" } as Parameters<typeof filterByHireOutcome>[0][number]["interest"],
        hireOutcome: { id: "o1", status: "interested" as const } as Parameters<typeof filterByHireOutcome>[0][number]["hireOutcome"],
      },
      {
        interest: { id: "3" } as Parameters<typeof filterByHireOutcome>[0][number]["interest"],
        hireOutcome: { id: "o2", status: "hired" as const } as Parameters<typeof filterByHireOutcome>[0][number]["hireOutcome"],
      },
      {
        interest: { id: "4" } as Parameters<typeof filterByHireOutcome>[0][number]["interest"],
        hireOutcome: { id: "o3", status: "started" as const } as Parameters<typeof filterByHireOutcome>[0][number]["hireOutcome"],
      },
    ];

    it("should return all interests for 'any' filter", () => {
      const result = filterByHireOutcome(mockInterests, "any");
      expect(result).toHaveLength(4);
    });

    it("should return only interests without outcomes for 'none' filter", () => {
      const result = filterByHireOutcome(mockInterests, "none");
      expect(result).toHaveLength(1);
      expect(result[0].interest.id).toBe("1");
    });

    it("should filter by interested status", () => {
      const result = filterByHireOutcome(mockInterests, "interested");
      expect(result).toHaveLength(1);
      expect(result[0].hireOutcome?.status).toBe("interested");
    });

    it("should filter by hired status", () => {
      const result = filterByHireOutcome(mockInterests, "hired");
      expect(result).toHaveLength(1);
      expect(result[0].hireOutcome?.status).toBe("hired");
    });

    it("should filter by started status", () => {
      const result = filterByHireOutcome(mockInterests, "started");
      expect(result).toHaveLength(1);
      expect(result[0].hireOutcome?.status).toBe("started");
    });
  });

  describe("hasHireOutcome", () => {
    it("should return false for null", () => {
      expect(hasHireOutcome(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(hasHireOutcome(undefined)).toBe(false);
    });

    it("should return true for valid outcome object", () => {
      const outcome = { 
        id: "1", 
        status: "hired" as const,
        interestId: "i1",
        hiredAt: null,
        startedAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(hasHireOutcome(outcome)).toBe(true);
    });
  });

  describe("getEffectiveStatus", () => {
    it("should return interested for null outcome", () => {
      expect(getEffectiveStatus(null)).toBe("interested");
    });

    it("should return interested for undefined outcome", () => {
      expect(getEffectiveStatus(undefined)).toBe("interested");
    });

    it("should return outcome status when present", () => {
      const hiredOutcome = { 
        id: "1", 
        status: "hired" as const,
        interestId: "i1",
        hiredAt: new Date(),
        startedAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const startedOutcome = { 
        id: "2", 
        status: "started" as const,
        interestId: "i2",
        hiredAt: new Date(),
        startedAt: new Date(),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(getEffectiveStatus(hiredOutcome)).toBe("hired");
      expect(getEffectiveStatus(startedOutcome)).toBe("started");
    });
  });
});
