import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireActiveAppUser = vi.fn();
const createReport = vi.fn();

vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveAppUser: (...args: unknown[]) => requireActiveAppUser(...args),
  deniedActiveUserResponse: () =>
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
}));

vi.mock("@/lib/safety/reports", () => ({
  REPORT_REASONS: [
    "scam_or_fake_job",
    "asked_for_money",
    "asked_for_documents",
    "harassment",
    "sexual_content",
    "underage_concern",
    "trafficking_concern",
    "spam",
    "other",
  ],
  createReport: (...args: unknown[]) => createReport(...args),
}));

describe("POST /api/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveAppUser.mockResolvedValue({
      ok: true,
      user: { userId: "worker-1", role: "worker" },
    });
  });

  it("rejects client-sent reportedUserId", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "spam",
        conversationId: "11111111-1111-4111-8111-111111111111",
        reportedUserId: "22222222-2222-4222-8222-222222222222",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(createReport).not.toHaveBeenCalled();
  });
});
