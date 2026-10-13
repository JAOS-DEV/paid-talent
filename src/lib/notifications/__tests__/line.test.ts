import { beforeEach, describe, expect, it, vi } from "vitest";

const getMessagingSettings = vi.fn();
const getLinePushesSentThisMonth = vi.fn();
const reserveLinePushBudget = vi.fn();
const releaseLinePushBudget = vi.fn();
const isLineMessagingConfigured = vi.fn();
const getLineMessagingChannelAccessToken = vi.fn();

const selectResults: unknown[][] = [];

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
  reserveLinePushBudget: (...args: unknown[]) => reserveLinePushBudget(...args),
  releaseLinePushBudget: (...args: unknown[]) => releaseLinePushBudget(...args),
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
  },
}));

import { LineChannel } from "../line";

const NOTIFICATION_ID = "11111111-1111-4111-8111-111111111111";

describe("LineChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    isLineMessagingConfigured.mockReturnValue(true);
    getLineMessagingChannelAccessToken.mockReturnValue("token");
    getMessagingSettings.mockResolvedValue({ lineMonthlyPushBudget: 300 });
    getLinePushesSentThisMonth.mockResolvedValue(0);
    reserveLinePushBudget.mockResolvedValue({ ok: true, pushesSent: 1 });
    releaseLinePushBudget.mockResolvedValue(undefined);
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

  it("returns non-retryable failure on 429 and releases reserved budget", async () => {
    selectResults.push([{ lineUserId: "U1" }]);
    const fetchImpl = vi.fn(async () => new Response("rate limit", { status: 429 }));
    const channel = new LineChannel(fetchImpl);
    const result = await channel.send(
      "user-1",
      {
        subject: "Paid Talent",
        text: "Paid Talent: You have a new contact request. Open the app: http://x",
        url: "http://x",
      },
      { notificationId: NOTIFICATION_ID }
    );
    expect(result).toEqual({
      ok: false,
      error: "line_quota_429",
      retryable: false,
    });
    expect(reserveLinePushBudget).toHaveBeenCalledTimes(1);
    expect(releaseLinePushBudget).toHaveBeenCalledTimes(1);
  });

  it("keeps reservation on success and does not release", async () => {
    selectResults.push([{ lineUserId: "U1" }]);
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const channel = new LineChannel(fetchImpl);
    const result = await channel.send(
      "user-1",
      {
        subject: "Paid Talent",
        text: "hello",
        url: "http://x",
      },
      { notificationId: NOTIFICATION_ID }
    );
    expect(result).toEqual({ ok: true });
    expect(reserveLinePushBudget).toHaveBeenCalledTimes(1);
    expect(releaseLinePushBudget).not.toHaveBeenCalled();
  });

  it("treats 409 as success and keeps reservation", async () => {
    selectResults.push([{ lineUserId: "U1" }]);
    const fetchImpl = vi.fn(async () => new Response("conflict", { status: 409 }));
    const channel = new LineChannel(fetchImpl);
    const result = await channel.send(
      "user-1",
      { subject: "s", text: "t", url: "http://x" },
      { notificationId: NOTIFICATION_ID }
    );
    expect(result).toEqual({ ok: true });
    expect(releaseLinePushBudget).not.toHaveBeenCalled();
  });

  it("uses the same X-Line-Retry-Key across two send attempts", async () => {
    selectResults.push([{ lineUserId: "U1" }], [{ lineUserId: "U1" }]);
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const channel = new LineChannel(fetchImpl);
    const rendered = { subject: "s", text: "t", url: "http://x" };

    await channel.send("user-1", rendered, { notificationId: NOTIFICATION_ID });
    await channel.send("user-1", rendered, { notificationId: NOTIFICATION_ID });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const key1 = (fetchImpl.mock.calls[0]?.[1] as RequestInit).headers;
    const key2 = (fetchImpl.mock.calls[1]?.[1] as RequestInit).headers;
    const headers1 = key1 as Record<string, string>;
    const headers2 = key2 as Record<string, string>;
    expect(headers1["X-Line-Retry-Key"]).toBe(NOTIFICATION_ID);
    expect(headers2["X-Line-Retry-Key"]).toBe(NOTIFICATION_ID);
  });

  it("falls back when budget reservation refuses", async () => {
    selectResults.push([{ lineUserId: "U1" }]);
    reserveLinePushBudget.mockResolvedValue({
      ok: false,
      reason: "budget_exhausted",
    });
    const fetchImpl = vi.fn();
    const channel = new LineChannel(fetchImpl);
    const result = await channel.send(
      "user-1",
      { subject: "s", text: "t", url: "http://x" },
      { notificationId: NOTIFICATION_ID }
    );
    expect(result).toEqual({
      ok: false,
      error: "budget_exhausted",
      retryable: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("marks 5xx as retryable and releases budget", async () => {
    selectResults.push([{ lineUserId: "U1" }]);
    const fetchImpl = vi.fn(async () => new Response("err", { status: 503 }));
    const channel = new LineChannel(fetchImpl);
    const result = await channel.send(
      "user-1",
      {
        subject: "s",
        text: "t",
        url: "http://x",
      },
      { notificationId: NOTIFICATION_ID }
    );
    expect(result).toEqual({
      ok: false,
      error: "line_http_503",
      retryable: true,
    });
    expect(releaseLinePushBudget).toHaveBeenCalledTimes(1);
  });
});
