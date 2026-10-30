import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getConversation = vi.fn();

vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveAppUser: vi.fn().mockResolvedValue({
    ok: true,
    user: { userId: "worker-1", role: "worker" },
  }),
  deniedActiveUserResponse: vi.fn(),
}));

vi.mock("@/lib/conversations", () => ({
  getConversation: (...args: unknown[]) => getConversation(...args),
}));

import { GET } from "../route";

function collectJsonKeys(value: unknown, keys: string[] = []): string[] {
  if (value == null || typeof value !== "object") {
    return keys;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonKeys(item, keys);
    }
    return keys;
  }
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key);
    collectJsonKeys(nested, keys);
  }
  return keys;
}

describe("GET /api/conversations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not expose user id fields in conversation detail JSON", async () => {
    getConversation.mockResolvedValue({
      ok: true,
      conversation: {
        id: "conv-1",
        status: "open",
        counterpart: {
          displayName: "Neon Bar",
          photoUrl: null,
        },
        safetyNotice: false,
        shareChannels: ["line"],
        messageMaxChars: 2000,
        messages: [
          {
            id: "msg-1",
            kind: "text",
            body: "Hello",
            isMine: false,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    });

    const request = { nextUrl: new URL("http://localhost/api/conversations/conv-1") } as NextRequest;
    const response = await GET(request, {
      params: Promise.resolve({ id: "conv-1" }),
    });
    const json = await response.json();
    const keys = collectJsonKeys(json);

    expect(keys.some((key) => /userId/i.test(key))).toBe(false);
    expect(keys.some((key) => ["isPro", "verifiedPro", "tier", "plan"].includes(key))).toBe(
      false
    );
  });
});
