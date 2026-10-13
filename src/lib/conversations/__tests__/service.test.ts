import { beforeEach, describe, expect, it, vi } from "vitest";

const getMessagingSettings = vi.fn();
const filterOutgoingText = vi.fn();

vi.mock("@/lib/messaging/settings", () => ({
  getMessagingSettings: (...args: unknown[]) => getMessagingSettings(...args),
}));

vi.mock("@/lib/messaging/content-filter", () => ({
  filterOutgoingText: (...args: unknown[]) => filterOutgoingText(...args),
}));

const limitResults: unknown[][] = [];
const insertReturning = vi.fn();
const updateReturning = vi.fn();

vi.mock("@/lib/db", () => {
  const conversations = { id: "id", status: "status" };
  const messages = { id: "id" };
  const messageFlags = { id: "id" };

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => limitResults.shift() ?? []),
            then(
              resolve: (value: unknown) => void,
              reject?: (reason: unknown) => void
            ): void {
              void Promise.resolve(limitResults.shift() ?? []).then(resolve, reject);
            },
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: insertReturning,
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: updateReturning,
          })),
        })),
      })),
    },
    conversations,
    messages,
    messageFlags,
    contactShares: {},
    contactRequests: {},
    profilePhotos: {},
    recruiterProfiles: {},
    users: {},
    venues: {},
    workerProfiles: {},
  };
});

import { hideConversation, sendMessage, shareContact } from "../service";

const openConversation = {
  id: "conv-1",
  contactRequestId: "cr-1",
  recruiterUserId: "rec-1",
  workerUserId: "worker-1",
  workerProfileId: "wp-1",
  venueId: "venue-1",
  status: "open",
  lastMessageAt: null,
  lastActivityAt: new Date(),
  retentionExpiresAt: new Date(),
  workerHiddenAt: null,
  recruiterHiddenAt: null,
  workerLastReadAt: null,
  recruiterLastReadAt: null,
  createdAt: new Date(),
};

describe("conversations service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitResults.length = 0;
    getMessagingSettings.mockResolvedValue({
      messageMaxChars: 2000,
      retentionDays: 180,
    });
  });

  it("blocks contact info and records a blocked_attempt flag", async () => {
    limitResults.push([openConversation], [{ value: 0 }]);
    filterOutgoingText.mockReturnValue({
      ok: false,
      code: "contact_info_blocked",
      types: ["phone_number"],
    });
    insertReturning.mockResolvedValue([{ id: "flag-1" }]);

    const result = await sendMessage("worker-1", "conv-1", "0812345678");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("contact_info_blocked");
    expect(result.nudge).toBe("use_share_button");
  });

  it("returns 409 when conversation is closed", async () => {
    limitResults.push([{ ...openConversation, status: "closed" }]);
    const result = await sendMessage("worker-1", "conv-1", "hello");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
  });

  it("hideConversation succeeds for participant", async () => {
    limitResults.push([openConversation]);
    updateReturning.mockResolvedValue([openConversation]);
    const result = await hideConversation("worker-1", "conv-1");
    expect(result.ok).toBe(true);
  });

  it("shareContact returns 400 when profile value is empty", async () => {
    limitResults.push(
      [openConversation],
      [{ lineId: null, phoneNumber: null, whatsappNumber: null }]
    );
    const result = await shareContact("worker-1", "conv-1", "line");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("no_value");
  });
});
