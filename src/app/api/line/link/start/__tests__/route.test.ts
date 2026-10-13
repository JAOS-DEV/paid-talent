import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireActiveAppUser = vi.fn();

vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveAppUser: (...args: unknown[]) => requireActiveAppUser(...args),
  deniedActiveUserResponse: () =>
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
}));

vi.mock("@/lib/line/config", () => ({
  isLineLoginConfigured: vi.fn(),
  getLineLoginChannelId: vi.fn(() => "login-channel-id"),
  getLineLinkCallbackUrl: vi.fn(
    () => "http://localhost:3000/api/line/link/callback"
  ),
}));

vi.mock("@/lib/line/state-cookie", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/line/state-cookie")
  >("@/lib/line/state-cookie");
  return {
    ...actual,
    signLineLinkStateCookie: vi.fn(() => "signed.cookie"),
  };
});

import { isLineLoginConfigured } from "@/lib/line/config";
import { GET } from "../../start/route";

describe("GET /api/line/link/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", "test-secret");
    requireActiveAppUser.mockResolvedValue({
      ok: true,
      user: { userId: "u1", role: "worker" },
    });
  });

  it("returns 404 when LINE login is not configured", async () => {
    vi.mocked(isLineLoginConfigured).mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("redirects to LINE authorize when configured", async () => {
    vi.mocked(isLineLoginConfigured).mockReturnValue(true);
    const res = await GET();
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("https://access.line.me/oauth2/v2.1/authorize");
    expect(location).toContain("bot_prompt=aggressive");
    expect(location).toContain("client_id=login-channel-id");
  });
});
