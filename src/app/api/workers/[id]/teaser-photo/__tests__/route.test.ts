import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const PHOTO_KEY = "profiles/worker-1/avatar.jpg";

vi.mock("@/lib/auth/require-active-user", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/require-active-user")>();
  return {
    ...actual,
    requireActiveRecruiter: vi.fn(),
  };
});

vi.mock("@/lib/storage/s3", () => ({
  getPublicMediaObjectBuffer: vi.fn(),
}));

vi.mock("@/lib/verification", () => ({
  isSearchableWorker: vi.fn(),
}));

vi.mock("sharp", () => {
  const chain = {
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    blur: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("webp-bytes")),
  };
  return { default: vi.fn(() => chain) };
});

vi.mock("next/server", () => {
  class MockNextResponse {
    body: unknown;
    status: number;
    headers: Map<string, string>;

    constructor(
      body: unknown,
      init?: { status?: number; headers?: Record<string, string> }
    ) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }

    static json(data: unknown, init?: { status?: number }) {
      return {
        json: async () => data,
        status: init?.status ?? 200,
        headers: new Map<string, string>(),
      };
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
      const buf = Buffer.isBuffer(this.body)
        ? this.body
        : Buffer.from(this.body as Uint8Array);
      return buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength
      );
    }
  }

  return { NextResponse: MockNextResponse };
});

import { requireActiveRecruiter } from "@/lib/auth/require-active-user";
import { db } from "@/lib/db";
import { getPublicMediaObjectBuffer } from "@/lib/storage/s3";
import { isSearchableWorker } from "@/lib/verification";
import {
  clearTeaserPhotoCacheForTests,
  GET,
} from "@/app/api/workers/[id]/teaser-photo/route";

const mockedAuth = vi.mocked(requireActiveRecruiter);
const mockedS3 = vi.mocked(getPublicMediaObjectBuffer);
const mockedSearchable = vi.mocked(isSearchableWorker);

function recruiter(): void {
  mockedAuth.mockResolvedValue({
    ok: true,
    user: {
      userId: "recruiter-1",
      email: "r@example.com",
      role: "recruiter",
      ageVerified: true,
    },
  });
}

function mockSelectChain(results: unknown[][]): void {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const rows = results[call] ?? [];
    call += 1;
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ limit });
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin, where });
    return { from } as never;
  });
}

describe("GET /api/workers/[id]/teaser-photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTeaserPhotoCacheForTests();
  });

  it("returns webp and never echoes the storage key", async () => {
    recruiter();
    mockedSearchable.mockReturnValue({
      isSearchable: true,
      reason: "verified",
    });
    mockedS3.mockResolvedValue(Buffer.from("jpeg-bytes"));
    mockSelectChain([
      [
        {
          profile: {
            id: "worker-profile-1",
            photoKey: PHOTO_KEY,
            photoUrl: "https://cdn.example/a.jpg",
            verificationStatus: "verified",
            isPublished: true,
          },
          accountStatus: "active",
        },
      ],
      [{ photoKey: PHOTO_KEY }],
    ]);

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ id: "worker-profile-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const headerValues = Array.from(response.headers.values()).join(" ");
    expect(headerValues).not.toContain(PHOTO_KEY);
    expect(headerValues).not.toContain("profiles/");

    const body = response.body;
    const asText =
      body instanceof Uint8Array
        ? Buffer.from(body).toString("utf8")
        : String(body ?? "");
    expect(asText).not.toContain(PHOTO_KEY);
  });

  it("returns 404 when photo_key is set but no approved profile_photos row", async () => {
    recruiter();
    mockedSearchable.mockReturnValue({
      isSearchable: true,
      reason: "verified",
    });
    mockSelectChain([
      [
        {
          profile: {
            id: "worker-profile-1",
            photoKey: PHOTO_KEY,
            photoUrl: "https://cdn.example/a.jpg",
            verificationStatus: "verified",
            isPublished: true,
          },
          accountStatus: "active",
        },
      ],
      [], // no approved current profile_photos row
    ]);

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ id: "worker-profile-1" }),
    });

    expect(response.status).toBe(404);
    expect(mockedS3).not.toHaveBeenCalled();
  });

  it("returns 404 for unsearchable worker", async () => {
    recruiter();
    mockedSearchable.mockReturnValue({
      isSearchable: false,
      reason: "not_verified",
    });
    mockSelectChain([
      [
        {
          profile: {
            id: "worker-profile-1",
            photoKey: PHOTO_KEY,
            photoUrl: null,
            verificationStatus: "pending",
            isPublished: true,
          },
          accountStatus: "active",
        },
      ],
    ]);

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ id: "worker-profile-1" }),
    });

    expect(response.status).toBe(404);
    expect(mockedS3).not.toHaveBeenCalled();
  });

  it("returns 401/403 for non-recruiter", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Not a recruiter",
      reason: "forbidden_role",
    });

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ id: "worker-profile-1" }),
    });

    expect(response.status).toBe(403);
    expect(mockedS3).not.toHaveBeenCalled();
  });
});
