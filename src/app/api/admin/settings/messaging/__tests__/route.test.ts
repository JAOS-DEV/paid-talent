import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminApi = vi.fn();
const getMessagingSettings = vi.fn();
const updateMessagingSettings = vi.fn();

vi.mock("@/lib/admin/api-guard", () => ({
  requireAdminApi: (...args: unknown[]) => requireAdminApi(...args),
}));

vi.mock("@/lib/messaging/settings", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/messaging/settings")>();
  return {
    ...actual,
    getMessagingSettings: (...args: unknown[]) => getMessagingSettings(...args),
    updateMessagingSettings: (...args: unknown[]) =>
      updateMessagingSettings(...args),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { GET, PUT } from "../route";
import { DEFAULT_MESSAGING_SETTINGS } from "@/lib/messaging/settings";

describe("/api/admin/settings/messaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 403 for non-admin", async () => {
    requireAdminApi.mockResolvedValue({
      ok: false,
      response: {
        status: 403,
        json: async () => ({ error: "Forbidden" }),
      },
    });

    const response = await GET();
    expect(response.status).toBe(403);
    expect(getMessagingSettings).not.toHaveBeenCalled();
  });

  it("PUT returns 403 for non-admin", async () => {
    requireAdminApi.mockResolvedValue({
      ok: false,
      response: {
        status: 403,
        json: async () => ({ error: "Forbidden" }),
      },
    });

    const response = await PUT(
      new Request("http://localhost/api/admin/settings/messaging", {
        method: "PUT",
        body: JSON.stringify({
          freeDailyNew: 2,
          reason: "Tighten caps",
        }),
      })
    );
    expect(response.status).toBe(403);
    expect(updateMessagingSettings).not.toHaveBeenCalled();
  });

  it("PUT returns per-field validation errors", async () => {
    requireAdminApi.mockResolvedValue({
      ok: true,
      actor: { userId: "admin-1", email: "admin@example.com" },
    });

    const response = await PUT(
      new Request("http://localhost/api/admin/settings/messaging", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freeDailyNew: 50,
          freeWeeklyNew: 10,
          reason: "Bad cross-field",
        }),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors.freeDailyNew).toBeTruthy();
    expect(updateMessagingSettings).not.toHaveBeenCalled();
  });

  it("PUT updates settings and relies on audit of changed fields only", async () => {
    requireAdminApi.mockResolvedValue({
      ok: true,
      actor: { userId: "admin-1", email: "admin@example.com" },
    });
    updateMessagingSettings.mockResolvedValue({
      ok: true,
      settings: {
        id: "default",
        ...DEFAULT_MESSAGING_SETTINGS,
        freeDailyNew: 2,
        updatedAt: new Date("2026-06-15T10:00:00.000Z"),
        updatedBy: "admin@example.com",
      },
    });

    const response = await PUT(
      new Request("http://localhost/api/admin/settings/messaging", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freeDailyNew: 2,
          reason: "Tighten free daily cap",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(updateMessagingSettings).toHaveBeenCalledWith({
      patch: { freeDailyNew: 2 },
      reason: "Tighten free daily cap",
      adminEmail: "admin@example.com",
      adminUserId: "admin-1",
    });
    const body = await response.json();
    expect(body.settings.freeDailyNew).toBe(2);
  });
});
