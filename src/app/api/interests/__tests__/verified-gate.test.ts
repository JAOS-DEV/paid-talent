import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/recruiter-access", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/recruiter-access")>();
  return {
    ...actual,
    requireVerifiedRecruiter: vi.fn(),
    deniedVerifiedRecruiterResponse: vi.fn(
      (result: { error: string; reason: string; status: number }) => ({
        json: async () => ({ error: result.error, reason: result.reason }),
        status: result.status,
      })
    ),
  };
});

import {
  requireVerifiedRecruiter,
  deniedVerifiedRecruiterResponse,
} from "@/lib/recruiter-access";
import { POST } from "@/app/api/interests/route";

const mockedRequire = vi.mocked(requireVerifiedRecruiter);

describe("POST /api/interests verified gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 recruiter_not_verified for unverified recruiters", async () => {
    mockedRequire.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Recruiter not verified",
      reason: "recruiter_not_verified",
    });

    const response = await POST({
      json: async () => ({ workerProfileId: "wp-1" }),
    } as NextRequest);

    expect(response.status).toBe(403);
    expect(deniedVerifiedRecruiterResponse).toHaveBeenCalled();
    const body = await response.json();
    expect(body.reason).toBe("recruiter_not_verified");
  });
});
