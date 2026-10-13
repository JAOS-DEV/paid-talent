import { beforeEach, describe, expect, it, vi } from "vitest";

const selectQueue: unknown[][] = [];
const insertReturning = vi.fn();
const deleteReturning = vi.fn();
const updateWhere = vi.fn();

vi.mock("@/lib/db", () => {
  const chainSelect = {
    from: vi.fn(() => chainSelect),
    innerJoin: vi.fn(() => chainSelect),
    where: vi.fn(() => chainSelect),
    limit: vi.fn(async () => selectQueue.shift() ?? []),
    then(
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void
    ): void {
      void Promise.resolve(selectQueue.shift() ?? []).then(resolve, reject);
    },
  };

  return {
    db: {
      select: vi.fn(() => chainSelect),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: insertReturning,
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: deleteReturning,
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: updateWhere.mockResolvedValue(undefined),
        })),
      })),
    },
    userBlocks: {
      id: "id",
      blockerUserId: "blocker_user_id",
      blockedUserId: "blocked_user_id",
      createdAt: "created_at",
    },
    users: { id: "id", name: "name" },
    conversations: {
      id: "id",
      workerUserId: "worker_user_id",
      recruiterUserId: "recruiter_user_id",
      status: "status",
    },
    contactRequests: {
      id: "id",
      workerUserId: "worker_user_id",
      recruiterUserId: "recruiter_user_id",
    },
  };
});

import {
  BLOCKED_CONTACT_MESSAGE,
  blockUser,
  isBlockedEitherWay,
  unblockUser,
} from "../blocks";

describe("blocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
  });

  it("isBlockedEitherWay is true when either direction exists", async () => {
    selectQueue.push([{ id: "b1" }]);
    await expect(isBlockedEitherWay("a", "b")).resolves.toBe(true);
  });

  it("isBlockedEitherWay is false when no row", async () => {
    selectQueue.push([]);
    await expect(isBlockedEitherWay("a", "b")).resolves.toBe(false);
  });

  it("blockUser via conversationId derives the other participant", async () => {
    selectQueue.push([
      {
        id: "conv-1",
        workerUserId: "user-a",
        recruiterUserId: "user-b",
      },
    ]);
    insertReturning.mockResolvedValue([
      {
        id: "block-1",
        blockerUserId: "user-a",
        blockedUserId: "user-b",
        createdAt: new Date(),
      },
    ]);

    const result = await blockUser({
      blockerUserId: "user-a",
      conversationId: "conv-1",
    });

    expect(result.ok).toBe(true);
    expect(updateWhere).toHaveBeenCalled();
  });

  it("blocking via conversationId by a non-participant returns 404", async () => {
    selectQueue.push([
      {
        id: "conv-1",
        workerUserId: "worker-1",
        recruiterUserId: "rec-1",
      },
    ]);

    const result = await blockUser({
      blockerUserId: "stranger",
      conversationId: "conv-1",
    });

    expect(result).toMatchObject({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });

  it("exports a generic blocked contact message", () => {
    expect(BLOCKED_CONTACT_MESSAGE).toBe("You can't contact this person");
  });

  it("unblockUser by block id returns 404 when missing", async () => {
    deleteReturning.mockResolvedValue([]);
    const result = await unblockUser({
      blockerUserId: "user-a",
      blockId: "missing-block",
    });
    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});
