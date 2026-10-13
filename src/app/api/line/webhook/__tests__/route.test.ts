import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateSets: Array<Record<string, unknown>> = [];
const updateWheres: unknown[] = [];

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn((patch: Record<string, unknown>) => {
        updateSets.push(patch);
        return {
          where: vi.fn(async (condition: unknown) => {
            updateWheres.push(condition);
            return [];
          }),
        };
      }),
    })),
  },
}));

vi.mock("@/lib/line/config", () => ({
  isLineMessagingConfigured: vi.fn(),
  getLineMessagingChannelSecret: vi.fn(),
}));

import {
  getLineMessagingChannelSecret,
  isLineMessagingConfigured,
} from "@/lib/line/config";
import { POST } from "../route";

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

describe("LINE webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSets.length = 0;
    updateWheres.length = 0;
    vi.mocked(isLineMessagingConfigured).mockReturnValue(true);
    vi.mocked(getLineMessagingChannelSecret).mockReturnValue("channel-secret");
  });

  it("returns 200 no-op when not configured", async () => {
    vi.mocked(isLineMessagingConfigured).mockReturnValue(false);
    const res = await POST(
      new Request("http://localhost/api/line/webhook", {
        method: "POST",
        body: "{}",
      }) as never
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("noop");
    expect(updateSets).toHaveLength(0);
  });

  it("rejects missing signature with 401", async () => {
    const res = await POST(
      new Request("http://localhost/api/line/webhook", {
        method: "POST",
        body: '{"events":[]}',
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it("rejects invalid signature with 401", async () => {
    const res = await POST(
      new Request("http://localhost/api/line/webhook", {
        method: "POST",
        headers: { "x-line-signature": "bad" },
        body: '{"events":[]}',
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it("updates is_friend on follow/unfollow", async () => {
    const body = JSON.stringify({
      events: [
        {
          type: "follow",
          source: { type: "user", userId: "Ufollow" },
        },
        {
          type: "unfollow",
          source: { type: "user", userId: "Uunfollow" },
        },
      ],
    });
    const res = await POST(
      new Request("http://localhost/api/line/webhook", {
        method: "POST",
        headers: { "x-line-signature": sign(body, "channel-secret") },
        body,
      }) as never
    );
    expect(res.status).toBe(200);
    expect(updateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isFriend: true }),
        expect.objectContaining({ isFriend: false }),
      ])
    );
  });

  it("ignores message events (no outbound fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const body = JSON.stringify({
      events: [
        {
          type: "message",
          source: { type: "user", userId: "Umsg" },
          message: { type: "text", text: "hi" },
        },
      ],
    });
    const res = await POST(
      new Request("http://localhost/api/line/webhook", {
        method: "POST",
        headers: { "x-line-signature": sign(body, "channel-secret") },
        body,
      }) as never
    );
    expect(res.status).toBe(200);
    expect(updateSets).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
