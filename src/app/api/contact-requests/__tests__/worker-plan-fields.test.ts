import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

function table(): object {
  return new Proxy(
    {},
    {
      get: () => ({}),
    }
  );
}

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  users: table(),
  workerProfiles: table(),
  contactRequests: table(),
  conversations: table(),
  recruiterOpenings: table(),
  venues: table(),
  profilePhotos: table(),
  messages: table(),
  messageFlags: table(),
  recruiterProfiles: table(),
  contactShares: table(),
}));

import { db } from "@/lib/db";

vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveAppUser: vi.fn(async () => ({
    ok: true,
    user: { userId: "worker-1", role: "worker" },
  })),
  deniedActiveUserResponse: vi.fn(),
}));

vi.mock("@/lib/contact-requests/service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/contact-requests/service")
  >("@/lib/contact-requests/service");
  return {
    ...actual,
    releaseQueuedForWorker: vi.fn(async () => 0),
  };
});

vi.mock("@/lib/messaging/settings", () => ({
  getMessagingSettings: vi.fn(async () => ({ messageMaxChars: 500 })),
}));

import { GET as getContactRequests } from "@/app/api/contact-requests/route";
import { GET as getConversationList } from "@/app/api/conversations/route";
import { GET as getConversation } from "@/app/api/conversations/[id]/route";

const PLAN_KEYS = ["isPro", "verifiedPro", "tier", "plan"];

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (value == null || typeof value !== "object") {
    return keys;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return keys;
  }
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key);
    collectKeys(nested, keys);
  }
  return keys;
}

function expectNoPlanKeys(value: unknown): void {
  const keys = collectKeys(value);
  expect(keys.filter((key) => PLAN_KEYS.includes(key))).toEqual([]);
}

function query(result: unknown): object {
  const api: Record<string, unknown> = {};
  const next = (): object => api;
  for (const method of [
    "from",
    "where",
    "orderBy",
    "innerJoin",
    "leftJoin",
    "set",
  ]) {
    api[method] = next;
  }
  api.limit = () => Promise.resolve(result);
  api.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);
  return api;
}

describe("worker payloads omit recruiter plan fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: () => ({ where: async () => undefined }),
        }) as never
    );
  });

  it("omits plan keys from GET /api/contact-requests?box=inbox", async () => {
    vi.mocked(db.select)
      .mockImplementationOnce(() => query([{ id: "profile-1" }]) as never)
      .mockImplementationOnce(
        () =>
          query([
            {
              id: "req-1",
              status: "pending",
              isPro: true,
              tier: "pro",
              plan: "verified_pro",
              openerText: "Hello",
              followUpText: null,
              followUpSentAt: null,
              deliveredAt: new Date("2026-01-02T00:00:00.000Z"),
              expiresAt: null,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              recruiterName: "Ann Recruiter",
              venueId: "venue-1",
              venueName: "Neon Bar",
              venueLogoUrl: null,
              venueLinkUrl: null,
              venueReviewStatus: "pending",
              openingRole: null,
              openingArea: null,
              payMin: null,
              payMax: null,
              payCurrency: null,
              payPeriod: null,
              openingIsPublished: false,
              conversationId: null,
            },
          ]) as never
      );

    const request = {
      nextUrl: new URL("http://localhost/api/contact-requests?box=inbox"),
    } as NextRequest;
    const response = await getContactRequests(request);
    const json = await response.json();

    expect(json.requests).toHaveLength(1);
    expect(json.requests[0].openerText).toBe("Hello");
    expectNoPlanKeys(json);
  });

  it("omits plan keys from the conversation list and detail", async () => {
    const conversationRow = {
      id: "conv-1",
      lastMessageAt: new Date("2026-01-03T00:00:00.000Z"),
      workerLastReadAt: null,
      recruiterLastReadAt: null,
      isPro: true,
      tier: "pro",
      plan: "verified_pro",
      venueName: "Neon Bar",
      venueLogoUrl: null,
      workerDisplayName: "Ann",
      workerUserName: "Ann Worker",
      workerPhotoUrl: null,
      approvedPhotoUrl: null,
    };

    vi.mocked(db.select)
      .mockImplementationOnce(() => query([conversationRow]) as never)
      .mockImplementationOnce(() => query([{ body: "Hello" }]) as never);

    const listJson = await (await getConversationList()).json();
    expect(listJson.conversations).toHaveLength(1);
    expectNoPlanKeys(listJson);

    vi.mocked(db.select)
      .mockImplementationOnce(
        () =>
          query([
            {
              conversation: {
                id: "conv-1",
                status: "open",
                workerHiddenAt: null,
                recruiterHiddenAt: null,
              },
              isPro: true,
              tier: "pro",
              plan: "verified_pro",
              contactRequestId: "req-1",
              venueName: "Neon Bar",
              venueLogoUrl: null,
              workerDisplayName: "Ann",
              workerUserName: "Ann Worker",
              workerPhotoUrl: null,
              approvedPhotoUrl: null,
            },
          ]) as never
      )
      .mockImplementationOnce(() => query([]) as never)
      .mockImplementationOnce(() => query([{ isFlagged: false }]) as never)
      .mockImplementationOnce(() => query([]) as never)
      .mockImplementationOnce(() => query([]) as never);

    const request = {
      nextUrl: new URL("http://localhost/api/conversations/conv-1"),
    } as NextRequest;
    const detailJson = await (
      await getConversation(request, { params: Promise.resolve({ id: "conv-1" }) })
    ).json();

    expect(detailJson.conversation.id).toBe("conv-1");
    expectNoPlanKeys(detailJson);
  });
});
