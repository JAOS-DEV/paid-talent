import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireActiveAppUser = vi.fn();
const insertValues = vi.fn();
const selectResults: unknown[][] = [];

vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveAppUser: (...args: unknown[]) => requireActiveAppUser(...args),
  deniedActiveUserResponse: () =>
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
}));

vi.mock("@/lib/line/config", () => ({
  isLineLoginConfigured: vi.fn(() => true),
  getLineLoginChannelId: vi.fn(() => "login-id"),
  getLineLoginChannelSecret: vi.fn(() => "login-secret"),
  getLineLinkCallbackUrl: vi.fn(
    () => "http://localhost:3000/api/line/link/callback"
  ),
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
    insert: vi.fn(() => ({
      values: vi.fn((vals: unknown) => {
        insertValues(vals);
        return {
          onConflictDoUpdate: vi.fn(async () => []),
        };
      }),
    })),
  },
}));

import {
  LINE_LINK_STATE_COOKIE,
  createLineLinkOAuthPayload,
  signLineLinkStateCookie,
} from "@/lib/line/state-cookie";
import { GET } from "../../callback/route";

function makeRequest(url: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) {
    headers.set("cookie", `${LINE_LINK_STATE_COOKIE}=${cookie}`);
  }
  return new NextRequest(url, { headers });
}

describe("GET /api/line/link/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    vi.stubEnv("AUTH_SECRET", "test-secret-line-callback");
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    requireActiveAppUser.mockResolvedValue({
      ok: true,
      user: { userId: "user-a", role: "worker" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/oauth2/v2.1/token")) {
          return new Response(
            JSON.stringify({
              access_token: "access",
              id_token: "idtok",
            }),
            { status: 200 }
          );
        }
        if (url.includes("/oauth2/v2.1/verify")) {
          return new Response(
            JSON.stringify({
              sub: "U_line_shared",
              name: "Line User",
            }),
            { status: 200 }
          );
        }
        if (url.includes("/friendship/v1/status")) {
          return new Response(JSON.stringify({ friendFlag: true }), {
            status: 200,
          });
        }
        return new Response("not found", { status: 404 });
      })
    );
  });

  it("rejects mismatched state", async () => {
    const payload = createLineLinkOAuthPayload();
    const cookie = signLineLinkStateCookie(payload);
    const res = await GET(
      makeRequest(
        "http://localhost:3000/api/line/link/callback?code=abc&state=wrong",
        cookie
      )
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("line=error");
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("redirects already_linked when LINE id belongs to another user", async () => {
    const payload = createLineLinkOAuthPayload();
    const cookie = signLineLinkStateCookie(payload);
    selectResults.push([{ userId: "other-user" }]);

    const res = await GET(
      makeRequest(
        `http://localhost:3000/api/line/link/callback?code=abc&state=${payload.state}`,
        cookie
      )
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("line=already_linked");
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("upserts link on success", async () => {
    const payload = createLineLinkOAuthPayload();
    const cookie = signLineLinkStateCookie(payload);
    selectResults.push([]);

    const res = await GET(
      makeRequest(
        `http://localhost:3000/api/line/link/callback?code=abc&state=${payload.state}`,
        cookie
      )
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("line=linked");
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-a",
        lineUserId: "U_line_shared",
        isFriend: true,
      })
    );
  });
});
