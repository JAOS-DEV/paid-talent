import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/media/venue-logo-service", () => ({
  presignVenueLogo: vi.fn(),
  confirmVenueLogo: vi.fn(),
  clearVenueLogo: vi.fn(),
}));

vi.mock("@/lib/auth/require-active-user", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/require-active-user")>();
  return {
    ...actual,
    requireActiveRecruiter: vi.fn(),
  };
});

import { revalidatePath } from "next/cache";
import { requireActiveRecruiter } from "@/lib/auth/require-active-user";
import {
  clearVenueLogo,
  confirmVenueLogo,
  presignVenueLogo,
} from "@/lib/media/venue-logo-service";
import { DELETE, POST, PUT } from "@/app/api/recruiter/logo/route";

const mockedAuth = vi.mocked(requireActiveRecruiter);
const mockedPresign = vi.mocked(presignVenueLogo);
const mockedConfirm = vi.mocked(confirmVenueLogo);
const mockedClear = vi.mocked(clearVenueLogo);

function recruiter(): void {
  mockedAuth.mockResolvedValue({
    ok: true,
    user: {
      userId: "recruiter-1",
      email: "venue@example.com",
      role: "recruiter",
      ageVerified: true,
    },
  });
}

function jsonRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as NextRequest;
}

describe("/api/recruiter/logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects workers and other non-recruiters", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Not a recruiter",
      reason: "forbidden_role",
    });

    const response = await POST(
      jsonRequest({
        contentType: "image/jpeg",
        contentLength: 128,
        folder: "profiles",
      })
    );

    expect(response.status).toBe(403);
    expect(mockedPresign).not.toHaveBeenCalled();
  });

  it("rejects an oversize presign request", async () => {
    recruiter();
    const response = await POST(
      jsonRequest({
        contentType: "image/jpeg",
        contentLength: 11 * 1024 * 1024,
        folder: "profiles",
      })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { message: string };
    expect(body.message).toMatch(/10 MB/);
    expect(mockedPresign).not.toHaveBeenCalled();
  });

  it("confirms an owned upload and revalidates venue pages", async () => {
    recruiter();
    mockedConfirm.mockResolvedValue({
      ok: true,
      logoKey: "profiles/recruiter-1/logo.jpeg",
      logoUrl: "https://cdn.example/profiles/recruiter-1/logo.jpeg",
    });

    const response = await PUT(
      jsonRequest({
        key: "profile-photo-staging/recruiter-1/logo.jpeg",
      })
    );

    expect(response.status).toBe(200);
    expect(mockedConfirm).toHaveBeenCalledWith(
      "recruiter-1",
      "profile-photo-staging/recruiter-1/logo.jpeg"
    );
    expect(revalidatePath).toHaveBeenCalledWith("/recruiter/profile");
    expect(revalidatePath).toHaveBeenCalledWith("/recruiter/openings");
  });

  it("clears the logo for the signed-in recruiter", async () => {
    recruiter();
    mockedClear.mockResolvedValue({ ok: true });
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(mockedClear).toHaveBeenCalledWith("recruiter-1");
  });
});
