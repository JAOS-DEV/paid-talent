import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminApi = vi.fn();
const reviewSubject = vi.fn();

vi.mock("@/lib/admin/api-guard", () => ({
  requireAdminApi: (...args: unknown[]) => requireAdminApi(...args),
}));

vi.mock("@/lib/admin/verification-review", () => ({
  reviewSubject: (...args: unknown[]) => reviewSubject(...args),
}));

import { POST } from "../route";

describe("POST /api/admin/recruiters/[id]/verify", () => {
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
      { params: Promise.resolve({ id: "recruiter-profile-1" }) }
    );

    expect(response.status).toBe(403);
    expect(reviewSubject).not.toHaveBeenCalled();
  });
});
