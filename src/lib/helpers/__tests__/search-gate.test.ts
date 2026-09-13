import { describe, it, expect } from "vitest";
import {
  filterSearchableWorkers,
  applyWorkerSearchFilters,
  getSearchableWorkersWithFilters,
} from "../search-gate";
import type { WorkerProfile } from "@/lib/db/schema";

function createMockProfile(
  overrides: Partial<WorkerProfile> = {}
): WorkerProfile {
  return {
    id: "test-id",
    userId: "user-id",
    photoKey: null,
    photoUrl: null,
    displayName: "Test Worker",
    location: "Bangkok",
    area: "Bangkok",
    description: null,
    bio: "Test bio",
    availability: "Full-time",
    expectedPayMin: null,
    expectedPayMax: null,
    payCurrency: "USD",
    jobRoles: ["Bartender"],
    experience: null,
    experienceYears: null,
    languages: ["English"],
    lineId: null,
    whatsappNumber: null,
    phoneNumber: null,
    isPublished: true,
    isVerified: false,
    verificationStatus: "verified",
    idDocumentKey: null,
    livenessVideoKey: null,
    challengeCode: null,
    challengeIssuedAt: null,
    idDocumentSubmittedAt: null,
    verificationReviewedAt: null,
    verificationReviewedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("search-gate helpers", () => {
  describe("filterSearchableWorkers", () => {
    it("should filter out unverified workers", () => {
      const profiles = [
        createMockProfile({ id: "1", verificationStatus: "verified" }),
        createMockProfile({ id: "2", verificationStatus: "unverified" }),
        createMockProfile({ id: "3", verificationStatus: "pending" }),
        createMockProfile({ id: "4", verificationStatus: "rejected" }),
      ];

      const result = filterSearchableWorkers(profiles);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should filter out unpublished workers even if verified", () => {
      const profiles = [
        createMockProfile({
          id: "1",
          verificationStatus: "verified",
          isPublished: true,
        }),
        createMockProfile({
          id: "2",
          verificationStatus: "verified",
          isPublished: false,
        }),
      ];

      const result = filterSearchableWorkers(profiles);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should return empty array when no workers are searchable", () => {
      const profiles = [
        createMockProfile({ verificationStatus: "unverified" }),
        createMockProfile({ verificationStatus: "pending" }),
      ];

      const result = filterSearchableWorkers(profiles);

      expect(result).toHaveLength(0);
    });

    it("should return all workers when all are verified and published", () => {
      const profiles = [
        createMockProfile({ id: "1", verificationStatus: "verified" }),
        createMockProfile({ id: "2", verificationStatus: "verified" }),
        createMockProfile({ id: "3", verificationStatus: "verified" }),
      ];

      const result = filterSearchableWorkers(profiles);

      expect(result).toHaveLength(3);
    });

    it("should handle empty input", () => {
      const result = filterSearchableWorkers([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("applyWorkerSearchFilters", () => {
    it("should filter by query matching displayName", () => {
      const profiles = [
        createMockProfile({ id: "1", displayName: "John Smith" }),
        createMockProfile({ id: "2", displayName: "Jane Doe" }),
      ];

      const result = applyWorkerSearchFilters(profiles, { query: "john" });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should filter by query matching bio", () => {
      const profiles = [
        createMockProfile({ id: "1", bio: "Experienced mixologist", jobRoles: ["Server"] }),
        createMockProfile({ id: "2", bio: "Great server", jobRoles: ["Chef"] }),
      ];

      const result = applyWorkerSearchFilters(profiles, { query: "mixologist" });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should filter by query matching job roles", () => {
      const profiles = [
        createMockProfile({ id: "1", jobRoles: ["Bartender", "Server"] }),
        createMockProfile({ id: "2", jobRoles: ["Chef"] }),
      ];

      const result = applyWorkerSearchFilters(profiles, { query: "server" });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should filter by area", () => {
      const profiles = [
        createMockProfile({ id: "1", area: "Bangkok" }),
        createMockProfile({ id: "2", area: "Phuket" }),
      ];

      const result = applyWorkerSearchFilters(profiles, { area: "Bangkok" });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should filter by job role", () => {
      const profiles = [
        createMockProfile({ id: "1", jobRoles: ["Bartender", "Server"] }),
        createMockProfile({ id: "2", jobRoles: ["Chef"] }),
      ];

      const result = applyWorkerSearchFilters(profiles, {
        jobRole: "Bartender",
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should filter by availability", () => {
      const profiles = [
        createMockProfile({ id: "1", availability: "Full-time" }),
        createMockProfile({ id: "2", availability: "Part-time" }),
      ];

      const result = applyWorkerSearchFilters(profiles, {
        availability: "Full-time",
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should combine multiple filters", () => {
      const profiles = [
        createMockProfile({
          id: "1",
          area: "Bangkok",
          jobRoles: ["Bartender"],
          availability: "Full-time",
        }),
        createMockProfile({
          id: "2",
          area: "Bangkok",
          jobRoles: ["Chef"],
          availability: "Full-time",
        }),
        createMockProfile({
          id: "3",
          area: "Phuket",
          jobRoles: ["Bartender"],
          availability: "Full-time",
        }),
      ];

      const result = applyWorkerSearchFilters(profiles, {
        area: "Bangkok",
        jobRole: "Bartender",
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should return all profiles when no filters applied", () => {
      const profiles = [
        createMockProfile({ id: "1" }),
        createMockProfile({ id: "2" }),
      ];

      const result = applyWorkerSearchFilters(profiles, {});

      expect(result).toHaveLength(2);
    });
  });

  describe("getSearchableWorkersWithFilters", () => {
    it("should apply verification gate before search filters", () => {
      const profiles = [
        createMockProfile({
          id: "1",
          verificationStatus: "verified",
          area: "Bangkok",
        }),
        createMockProfile({
          id: "2",
          verificationStatus: "verified",
          area: "Phuket",
        }),
        createMockProfile({
          id: "3",
          verificationStatus: "pending",
          area: "Bangkok",
        }),
        createMockProfile({
          id: "4",
          verificationStatus: "unverified",
          area: "Bangkok",
        }),
      ];

      const result = getSearchableWorkersWithFilters(profiles, {
        area: "Bangkok",
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should return empty when no verified workers match filters", () => {
      const profiles = [
        createMockProfile({
          id: "1",
          verificationStatus: "verified",
          area: "Bangkok",
        }),
        createMockProfile({
          id: "2",
          verificationStatus: "pending",
          area: "Phuket",
        }),
      ];

      const result = getSearchableWorkersWithFilters(profiles, {
        area: "Phuket",
      });

      expect(result).toHaveLength(0);
    });

    it("should handle complex filter combinations", () => {
      const profiles = [
        createMockProfile({
          id: "1",
          verificationStatus: "verified",
          isPublished: true,
          displayName: "Expert Bartender",
          area: "Bangkok",
          jobRoles: ["Bartender"],
          availability: "Full-time",
        }),
        createMockProfile({
          id: "2",
          verificationStatus: "verified",
          isPublished: true,
          displayName: "Senior Chef",
          area: "Bangkok",
          jobRoles: ["Chef"],
          availability: "Full-time",
        }),
        createMockProfile({
          id: "3",
          verificationStatus: "verified",
          isPublished: false,
          displayName: "Bartender Pro",
          area: "Bangkok",
          jobRoles: ["Bartender"],
          availability: "Full-time",
        }),
      ];

      const result = getSearchableWorkersWithFilters(profiles, {
        query: "bartender",
        area: "Bangkok",
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });
  });
});
