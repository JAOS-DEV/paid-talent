import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLineLoginConfigured,
  isLineMessagingConfigured,
} from "@/lib/line/config";
import { getNotificationChannels } from "@/lib/notifications/channels";

describe("LINE config no-op when env missing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("isLineLoginConfigured is false without env", () => {
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "");
    vi.stubEnv("LINE_LOGIN_CHANNEL_SECRET", "");
    expect(isLineLoginConfigured()).toBe(false);
  });

  it("isLineMessagingConfigured is false without env", () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_SECRET", "");
    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "");
    expect(isLineMessagingConfigured()).toBe(false);
  });

  it("does not register LineChannel when messaging env missing", () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_SECRET", "");
    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "");
    const channels = getNotificationChannels();
    expect(channels.some((c) => c.name === "line")).toBe(false);
    expect(channels.some((c) => c.name === "email")).toBe(true);
  });

  it("registers LineChannel first when messaging env present", () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_SECRET", "secret");
    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "token");
    const channels = getNotificationChannels();
    expect(channels[0]?.name).toBe("line");
    expect(channels.some((c) => c.name === "email")).toBe(true);
  });
});
