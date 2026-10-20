import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { ACCOUNT_DELETION_CONFIRM_PHRASE, SELF_DELETION_REASON } from "@/lib/account/constants";

const requireActiveAppUser = vi.fn();
const sets: Array<Record<string, unknown>> = [];

vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveAppUser: (...args: unknown[]) => requireActiveAppUser(...args),
  deniedActiveUserResponse: () =>
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: "user-1",
              email: "worker@example.com",
              accountStatus: "active",
            },
          ],
        }),
      }),
    })),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => {
        sets.push(values);
        return { where: async () => undefined };
      },
    })),
    insert: vi.fn(() => ({
      values: async () => undefined,
    })),
  };

  return {
    db: {
      transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    },
    users: {},
    workerProfiles: {},
    recruiterProfiles: {},
    recruiterOpenings: {},
    contactRequests: {},
    conversations: {},
    adminAuditEvents: {},
  };
});

describe("POST /api/account/delete-request", () => {
  beforeEach(() => {
    sets.length = 0;
    requireActiveAppUser.mockResolvedValue({
      ok: true,
      user: {
        userId: "user-1",
        email: "worker@example.com",
        role: "worker",
      },
    });
  });

  it("requires the confirm phrase", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/account/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPhrase: "delete" }),
      })
    );
    expect(response.status).toBe(400);
    expect(sets).toHaveLength(0);
  });

  it("suspends the account and withdraws open requests", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/account/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmPhrase: ACCOUNT_DELETION_CONFIRM_PHRASE,
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(sets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isPublished: false }),
        expect.objectContaining({
          accountStatus: "suspended",
          accountStatusReason: SELF_DELETION_REASON,
          deletionRequestedAt: expect.any(Date),
        }),
        expect.objectContaining({ status: "withdrawn" }),
        expect.objectContaining({ status: "closed" }),
      ])
    );
  });
});
