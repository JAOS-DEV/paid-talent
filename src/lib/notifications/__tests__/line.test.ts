import { beforeEach, describe, expect, it, vi } from "vitest";

const getMessagingSettings = vi.fn();
const getLinePushesSentThisMonth = vi.fn();
const incrementLinePushUsage = vi.fn();
const isLineMessagingConfigured = vi.fn();
const getLineMessagingChannelAccessToken = vi.fn();

const selectResults: unknown[][] = [];
const transactionCalls: unknown[] = [];

vi.mock("@/lib/messaging/settings", () => ({
  getMessagingSettings: (...args: unknown[]) => getMessagingSettings(...args),
}));

vi.mock("@/lib/line/config", () => ({
  isLineMessagingConfigured: (...args: unknown[]) =>
    isLineMessagingConfigured(...args),
  getLineMessagingChannelAccessToken: (...args: unknown[]) =>
    getLineMessagingChannelAccessToken(...args),
}));

vi.mock("@/lib/line/usage", () => ({
  getLinePushesSentThisMonth: (...args: unknown[]) =>
    getLinePushesSentThisMonth(...args),
  incrementLinePushUsage: (...args: unknown[]) =>
    incrementLinePushUsage(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectResults.shift() ?? []),
        })),
      })),
    })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      transactionCalls.push(true);
      return fn({});
    }),
  },
}));

import { LineChannel } from "../line";

describe("LineChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    transactionCalls.length = 0;
    isLineMessagingConfigured.mockReturnValue(true);
    getLineMessagingChannelAccessToken.mockReturnValue("token");
    getMessagingSettings.mockResolvedValue({ lineMonthlyPushBudget: 300 });
    getLinePushesSentThisMonth.mockResolvedValue(0);
    incrementLinePushUsage.mockResolvedValue(undefined);
  });

  it("canDeliverTo is false when monthly budget reached", async () => {
    selectResults.push([{ lineEnabled: true }], [
      { lineUserId: "U1", isFriend: true },
    ]);
    getLinePushesSentThisMonth.mockResolvedValue(300);
    const channel = new LineChannel();
    const result = await channel.canDeliverTo("user-1");
    expect(result).toEqual({ ok: false, reason: "budget_exhausted" });
  });

  it("returns non-retryable failure on 429 and does not increment usage", async () => {
    selectResults.push([{ lineUserId: "U1" }]);
    const fetchImpl = vi.fn(async () => new Response("rate limit", { status: 429 }));
    const channel = new LineChannel(fetchImpl);
    const result = await channel.send("user-1", {
      subject: "Paid Talent",
      text: "Paid Talent: You have a new contact request. Open the app: http://x",
      url: "http://x",
    });
    expect(result).toEqual({
      ok: false,
      error: "line_quota_429",
      retryable: false,
    });
    expect(incrementLinePushUsage).not.toHaveBeenCalled();
  });

  it("increments usage only on success", async () => {
    selectResults.push([{ lineUserId: "U1" }]);
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const channel = new LineChannel(fetchImpl);
    const result = await channel.send("user-1", {
      subject: "Paid Talent",
      text: "hello",
      url: "http://x",
    });
    expect(result).toEqual({ ok: true });
    expect(incrementLinePushUsage).toHaveBeenCalledTimes(1);
    expect(transactionCalls).toHaveLength(1);
  });

  it("marks 5xx as retryable", async () => {
    selectResults.push([{ lineUserId: "U1" }]);
    const fetchImpl = vi.fn(async () => new Response("err", { status: 503 }));
    const channel = new LineChannel(fetchImpl);
    const result = await channel.send("user-1", {
      subject: "s",
      text: "t",
      url: "http://x",
    });
    expect(result).toEqual({
      ok: false,
      error: "line_http_503",
      retryable: true,
    });
  });
});
