import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getEffectiveEntitlement,
  getFreeMaxVenues,
  getPaidMaxVenues,
  select,
  insert,
  update,
  selectResults,
  updateSetArgs,
  insertReturning,
  updateReturning,
} = vi.hoisted(() => {
  type QueryResult = unknown[];
  const selectResults: QueryResult[] = [];
  const updateSetArgs: Record<string, unknown>[] = [];

  function createSelectChain(result: QueryResult) {
    const promise = Promise.resolve(result);
    const chain: {
      from: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      then: typeof promise.then;
    } = {
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn(),
      then: promise.then.bind(promise),
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.orderBy.mockReturnValue(chain);
    chain.limit.mockResolvedValue(result);
    return chain;
  }

  const select = vi.fn(() => {
    const next = selectResults.shift() ?? [];
    return createSelectChain(next);
  });

  const insertReturning = vi.fn();
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));

  const updateReturning = vi.fn();
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn((args: Record<string, unknown>) => {
    updateSetArgs.push(args);
    return { where: updateWhere };
  });
  const update = vi.fn(() => ({ set: updateSet }));

  const getEffectiveEntitlement = vi.fn();
  const getFreeMaxVenues = vi.fn(async () => 1);
  const getPaidMaxVenues = vi.fn(async () => 5);

  return {
    getEffectiveEntitlement,
    getFreeMaxVenues,
    getPaidMaxVenues,
    select,
    insert,
    update,
    selectResults,
    updateSetArgs,
    insertReturning,
    updateReturning,
  };
});

vi.mock("@/lib/entitlements", () => ({
  getEffectiveEntitlement: (...args: unknown[]) =>
    getEffectiveEntitlement(...args),
}));

vi.mock("../limits", () => ({
  getFreeMaxVenues: (...args: unknown[]) => getFreeMaxVenues(...args),
  getPaidMaxVenues: (...args: unknown[]) => getPaidMaxVenues(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select,
    insert,
    update,
  },
  venues: {
    id: "id",
    recruiterProfileId: "recruiter_profile_id",
    archivedAt: "archived_at",
    isPrimary: "is_primary",
    createdAt: "created_at",
    venueLinkUrl: "venue_link_url",
    venueLinkKind: "venue_link_kind",
  },
  recruiterProfiles: {
    id: "id",
    userId: "user_id",
  },
}));

import {
  archiveVenue,
  createVenue,
  getMaxVenues,
  updateVenue,
} from "../service";

describe("venues service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    updateSetArgs.length = 0;
    insertReturning.mockReset();
    updateReturning.mockReset();
    getFreeMaxVenues.mockResolvedValue(1);
    getPaidMaxVenues.mockResolvedValue(5);
  });

  describe("getMaxVenues", () => {
    it("returns free limit by default", async () => {
      getEffectiveEntitlement.mockResolvedValue({
        paidAccess: false,
        adminGrantAccess: false,
        hasPremiumAccess: false,
      });
      await expect(getMaxVenues("user-1")).resolves.toBe(1);
    });

    it("returns paid limit when paidAccess is true", async () => {
      getEffectiveEntitlement.mockResolvedValue({
        paidAccess: true,
        adminGrantAccess: false,
        hasPremiumAccess: true,
      });
      await expect(getMaxVenues("user-1")).resolves.toBe(5);
    });

    it("returns paid limit when adminGrantAccess is true", async () => {
      getEffectiveEntitlement.mockResolvedValue({
        paidAccess: false,
        adminGrantAccess: true,
        hasPremiumAccess: true,
      });
      await expect(getMaxVenues("user-1")).resolves.toBe(5);
    });

    it("does not raise limit for open_access alone", async () => {
      getEffectiveEntitlement.mockResolvedValue({
        paidAccess: false,
        adminGrantAccess: false,
        hasPremiumAccess: true,
        billingAccessMode: "open_access",
      });
      await expect(getMaxVenues("user-1")).resolves.toBe(1);
    });
  });

  describe("createVenue", () => {
    it("enforces free max of 1", async () => {
      selectResults.push([{ userId: "user-1" }], [{ value: 1 }]);
      getEffectiveEntitlement.mockResolvedValue({
        paidAccess: false,
        adminGrantAccess: false,
      });

      const result = await createVenue("profile-1", {
        name: "Second Venue",
        venueLinkUrl: "https://www.facebook.com/second",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/at most 1/i);
      }
      expect(insert).not.toHaveBeenCalled();
    });

    it("allows up to paid max of 5", async () => {
      selectResults.push([{ userId: "user-1" }], [{ value: 4 }]);
      getEffectiveEntitlement.mockResolvedValue({
        paidAccess: true,
        adminGrantAccess: false,
      });
      insertReturning.mockResolvedValueOnce([
        {
          id: "venue-5",
          name: "Fifth",
          venueLinkUrl: "https://www.facebook.com/fifth",
        },
      ]);

      const result = await createVenue("profile-1", {
        name: "Fifth",
        venueLinkUrl: "https://www.facebook.com/fifth",
      });

      expect(result.ok).toBe(true);
      expect(insert).toHaveBeenCalled();
    });
  });

  describe("updateVenue", () => {
    it("resets review status to pending when link changes", async () => {
      selectResults.push([
        {
          id: "venue-1",
          recruiterProfileId: "profile-1",
          name: "Sky Bar",
          venueLinkUrl: "https://www.facebook.com/old",
          venueLinkKind: "facebook",
          archivedAt: null,
          isPrimary: true,
        },
      ]);
      updateReturning.mockResolvedValueOnce([
        {
          id: "venue-1",
          reviewStatus: "pending",
          venueLinkUrl: "https://instagram.com/skybar",
        },
      ]);

      const result = await updateVenue("venue-1", "profile-1", {
        name: "Sky Bar",
        venueLinkUrl: "https://instagram.com/skybar",
      });

      expect(result.ok).toBe(true);
      expect(updateSetArgs[0]?.reviewStatus).toBe("pending");
      expect(updateSetArgs[0]?.reviewedAt).toBeNull();
      expect(updateSetArgs[0]?.reviewedBy).toBeNull();
    });
  });

  describe("archiveVenue", () => {
    it("cannot archive the last active venue", async () => {
      selectResults.push(
        [
          {
            id: "venue-1",
            recruiterProfileId: "profile-1",
            isPrimary: true,
            archivedAt: null,
          },
        ],
        [{ value: 1 }]
      );

      const result = await archiveVenue("venue-1", "profile-1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/at least one/i);
      }
    });

    it("promotes the oldest other active venue when archiving primary", async () => {
      selectResults.push(
        [
          {
            id: "venue-1",
            recruiterProfileId: "profile-1",
            isPrimary: true,
            archivedAt: null,
          },
        ],
        [{ value: 2 }],
        [
          {
            id: "venue-2",
            recruiterProfileId: "profile-1",
            isPrimary: false,
            archivedAt: null,
          },
        ]
      );
      updateReturning.mockResolvedValueOnce([
        {
          id: "venue-1",
          archivedAt: new Date(),
          isPrimary: false,
        },
      ]);

      const result = await archiveVenue("venue-1", "profile-1");
      expect(result.ok).toBe(true);
      expect(update).toHaveBeenCalledTimes(2);
    });
  });
});
