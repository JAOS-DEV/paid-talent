import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminApi = vi.fn();
const reviewVenue = vi.fn();

vi.mock("@/lib/admin/api-guard", () => ({
  requireAdminApi: (...args: unknown[]) => requireAdminApi(...args),
}));

vi.mock("@/lib/venues/review", () => ({
  reviewVenue: (...args: unknown[]) => reviewVenue(...args),
}));

import { POST } from "../route";

describe("POST /api/admin/venues/[id]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-admin callers", async () => {
    requireAdminApi.mockResolvedValue({
      ok: false,
      response: {
        status: 403,
        json: async () => ({ error: "Forbidden" }),
      },
    });

    const response = await POST(
      {
        json: async () => ({ action: "approve" }),
      } as never,
      { params: Promise.resolve({ id: "venue-1" }) }
    );

    expect(response.status).toBe(403);
    expect(reviewVenue).not.toHaveBeenCalled();
  });

  it("returns 400 when rejecting without a note", async () => {
    requireAdminApi.mockResolvedValue({
      ok: true,
      actor: { userId: "admin-1", email: "admin@example.com" },
    });

    const response = await POST(
      {
        json: async () => ({ action: "reject" }),
      } as never,
      { params: Promise.resolve({ id: "venue-1" }) }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.reason).toBe("note_required");
    expect(reviewVenue).not.toHaveBeenCalled();
  });

  it("approves and audits via reviewVenue", async () => {
    requireAdminApi.mockResolvedValue({
      ok: true,
      actor: { userId: "admin-1", email: "admin@example.com" },
    });
    reviewVenue.mockResolvedValue({
      ok: true,
      action: "approve",
      venue: {
        id: "venue-1",
        name: "Sky Bar",
        reviewStatus: "approved",
        reviewNote: null,
        reviewedAt: new Date("2026-01-01T00:00:00Z"),
        reviewedBy: "admin@example.com",
      },
    });

    const response = await POST(
      {
        json: async () => ({ action: "approve" }),
      } as never,
      { params: Promise.resolve({ id: "venue-1" }) }
    );

    expect(response.status).toBe(200);
    expect(reviewVenue).toHaveBeenCalledWith({
      venueId: "venue-1",
      action: "approve",
      note: undefined,
      admin: { userId: "admin-1", email: "admin@example.com" },
    });
    const body = await response.json();
    expect(body.eventLogged).toBe(true);
    expect(body.venue.reviewStatus).toBe("approved");
  });
});
