import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireActiveAppUser = vi.fn();
const listNotificationsForUser = vi.fn();
const markNotificationsRead = vi.fn();
const getNotificationPrefs = vi.fn();

vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveAppUser: (...args: unknown[]) => requireActiveAppUser(...args),
  deniedActiveUserResponse: () =>
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
}));

vi.mock("@/lib/notifications", () => ({
  listNotificationsForUser: (...args: unknown[]) =>
    listNotificationsForUser(...args),
  markNotificationsRead: (...args: unknown[]) => markNotificationsRead(...args),
}));

vi.mock("@/lib/notifications/prefs", () => ({
  getNotificationPrefs: (...args: unknown[]) => getNotificationPrefs(...args),
}));

vi.mock("@/lib/notifications/render", () => ({
  renderNotification: () => ({
    subject: "Subject",
    text: "Text",
    url: "http://localhost:3000/worker/requests",
  }),
}));

describe("notifications routes ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveAppUser.mockResolvedValue({
      ok: true,
      user: { userId: "user-a", role: "worker" },
    });
    getNotificationPrefs.mockResolvedValue({ locale: "en" });
    listNotificationsForUser.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
    });
    markNotificationsRead.mockResolvedValue(1);
  });

  it("GET lists only the authenticated user's notifications", async () => {
    const { GET } = await import("../route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(listNotificationsForUser).toHaveBeenCalledWith("user-a", 50);
  });

  it("POST read marks only the authenticated user's notifications", async () => {
    const { POST } = await import("../read/route");
    const response = await POST(
      new Request("http://localhost/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: ["11111111-1111-4111-8111-111111111111"],
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(markNotificationsRead).toHaveBeenCalledWith({
      userId: "user-a",
      ids: ["11111111-1111-4111-8111-111111111111"],
      all: false,
    });
  });

  it("rejects unauthenticated access", async () => {
    requireActiveAppUser.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      reason: "unauthenticated",
    });
    const { GET } = await import("../route");
    const response = await GET();
    expect(response.status).toBe(401);
    expect(listNotificationsForUser).not.toHaveBeenCalled();
  });
});
