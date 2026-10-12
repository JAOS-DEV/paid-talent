import { beforeEach, describe, expect, it, vi } from "vitest";

const getMessagingSettings = vi.fn();
const onConflictDoNothing = vi.fn();
const conversationInsertReturning = vi.fn();
const interestInsertValues = vi.fn();
const updateReturning = vi.fn();
const selectLimit = vi.fn();

vi.mock("@/lib/messaging/settings", () => ({
  getMessagingSettings: (...args: unknown[]) => getMessagingSettings(...args),
}));

vi.mock("@/lib/db", () => {
  const contactRequests = {
    id: "id",
    workerUserId: "worker_user_id",
    workerProfileId: "worker_profile_id",
    status: "status",
  };
  const conversations = { id: "id" };
  const profileInterests = {
    id: "id",
    recruiterUserId: "recruiter_user_id",
    workerProfileId: "worker_profile_id",
  };

  function makeTx() {
    return {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: selectLimit,
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: updateReturning,
          })),
        })),
      })),
      insert: vi.fn((table: unknown) => {
        if (table === conversations) {
          return {
            values: vi.fn(() => ({
              returning: conversationInsertReturning,
            })),
          };
        }
        if (table === profileInterests) {
          return {
            values: interestInsertValues.mockReturnValue({
              onConflictDoNothing,
            }),
          };
        }
        return {
          values: vi.fn(() => ({
            returning: vi.fn(),
            onConflictDoNothing,
          })),
        };
      }),
      execute: vi.fn(async () => undefined),
    };
  }

  return {
    db: {
      transaction: vi.fn(async (fn: (tx: ReturnType<typeof makeTx>) => unknown) =>
        fn(makeTx())
      ),
    },
    contactRequests,
    conversations,
    profileInterests,
    recruiterOpenings: {},
    userNotificationPrefs: {},
    users: {},
    workerProfiles: {},
  };
});

import { acceptRequest } from "../service";

const pendingRequest = {
  id: "cr-1",
  recruiterUserId: "rec-user-1",
  recruiterProfileId: "rec-profile-1",
  venueId: "venue-1",
  workerUserId: "worker-user-1",
  workerProfileId: "worker-profile-1",
  openingId: null,
  openerText: "Hi",
  status: "pending" as const,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  respondedAt: null,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("acceptRequest profile_interests conflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMessagingSettings.mockResolvedValue({
      retentionDays: 30,
      freeDailyCap: 3,
      freeWeeklyCap: 10,
      freePendingCap: 5,
      proDailyCap: 20,
      proWeeklyCap: 50,
      proPendingCap: 20,
      freeTopTalentDailyCap: 0,
      proTopTalentDailyCap: 5,
      newRecruiterDailyHoldDays: 7,
      newRecruiterDailyCap: 1,
      declineCooldownHours: 24,
      followUpMinHours: 48,
      followUpMaxPerRequest: 1,
    });

    selectLimit.mockResolvedValue([pendingRequest]);
    updateReturning.mockResolvedValue([
      { ...pendingRequest, status: "accepted" },
    ]);
    conversationInsertReturning.mockResolvedValue([
      {
        id: "conv-1",
        contactRequestId: pendingRequest.id,
        status: "open",
      },
    ]);
    // Simulate existing profile_interests row for the same pair (unique conflict):
    // insert is attempted, onConflictDoNothing() swallows it.
    onConflictDoNothing.mockResolvedValue(undefined);
  });

  it("succeeds and creates exactly one conversation when a legacy interest row exists for the same pair with a different id", async () => {
    const result = await acceptRequest("worker-user-1", "cr-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.conversation.id).toBe("conv-1");
    expect(conversationInsertReturning).toHaveBeenCalledTimes(1);
    expect(interestInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cr-1",
        recruiterUserId: "rec-user-1",
        workerProfileId: "worker-profile-1",
      })
    );
    // Must not target only primary key — unique pair conflicts must also be ignored.
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
    expect(onConflictDoNothing).toHaveBeenCalledWith();
  });
});
