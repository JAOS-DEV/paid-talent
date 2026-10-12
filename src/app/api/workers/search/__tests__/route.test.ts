import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/auth/require-active-user", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/require-active-user")>();
  return {
    ...actual,
    requireActiveRecruiter: vi.fn(),
  };
});

vi.mock("@/lib/recruiter-access", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/recruiter-access")>();
  return {
    ...actual,
    getRecruiterAccess: vi.fn(),
  };
});

vi.mock("@/lib/ranking", () => ({
  isProfileTopTalent: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/verification", () => ({
  isSearchableWorker: vi.fn().mockReturnValue({
    isSearchable: true,
    reason: "verified",
  }),
}));

vi.mock("@/lib/helpers/search-filters", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/helpers/search-filters")>();
  return {
    ...actual,
    validateSearchParams: vi.fn(),
    buildFilterCriteria: vi.fn(),
  };
});

import { requireActiveRecruiter } from "@/lib/auth/require-active-user";
import { getRecruiterAccess } from "@/lib/recruiter-access";
import {
  buildFilterCriteria,
  validateSearchParams,
} from "@/lib/helpers/search-filters";
import { db } from "@/lib/db";
import { GET } from "@/app/api/workers/search/route";

const mockedAuth = vi.mocked(requireActiveRecruiter);
const mockedAccess = vi.mocked(getRecruiterAccess);
const mockedValidate = vi.mocked(validateSearchParams);
const mockedBuild = vi.mocked(buildFilterCriteria);

function requestWithQuery(query: string): NextRequest {
  return {
    url: `http://localhost/api/workers/search?q=${encodeURIComponent(query)}&maxPay=20000`,
  } as NextRequest;
}

function mockEmptySearchDb(): void {
  vi.mocked(db.select).mockImplementation(() => {
    const emptyPage = {
      offset: vi.fn().mockResolvedValue([]),
    };
    const limited = {
      limit: vi.fn().mockReturnValue(emptyPage),
    };
    const ordered = {
      orderBy: vi.fn().mockReturnValue(limited),
    };
    // Profiles query ends with orderBy/limit/offset; count query awaits where().
    const whereResult = Object.assign(ordered, {
      then: (
        resolve: (value: Array<{ count: number }>) => unknown
      ) => Promise.resolve([{ count: 0 }]).then(resolve),
    });
    const joined = {
      where: vi.fn().mockReturnValue(whereResult),
    };
    return {
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue(joined),
      }),
    } as never;
  });
}

describe("GET /api/workers/search access filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({
      ok: true,
      user: {
        userId: "recruiter-1",
        email: "r@example.com",
        role: "recruiter",
        ageVerified: true,
      },
    });

    mockedValidate.mockReturnValue({
      success: true,
      data: {
        query: undefined,
        role: undefined,
        area: undefined,
        availability: undefined,
        verified: undefined,
        maxPay: undefined,
        payPeriod: undefined,
        limit: 20,
        offset: 0,
      },
    } as never);

    mockedBuild.mockReturnValue({
      query: undefined,
      role: undefined,
      area: undefined,
      availability: undefined,
      maxPay: undefined,
      payPeriod: undefined,
    } as never);

    mockEmptySearchDb();
  });

  it("ignores query param for unverified recruiters", async () => {
    mockedAccess.mockResolvedValue({
      userId: "recruiter-1",
      recruiterProfileId: "rp-1",
      identityStatus: "unverified",
      hasApprovedVenue: false,
      approvedVenueIds: [],
      primaryVenueId: null,
      isVerified: false,
      tier: "unverified",
      verifiedAt: null,
      isPaused: false,
      canBrowseFull: false,
      canViewTopTalentFull: false,
      billingAccessMode: "enforced",
    });

    await GET(requestWithQuery("secret-bio-probe"));

    expect(mockedValidate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: undefined,
        maxPay: undefined,
        payPeriod: undefined,
      })
    );
  });

  it("passes query param for verified recruiters", async () => {
    mockedAccess.mockResolvedValue({
      userId: "recruiter-1",
      recruiterProfileId: "rp-1",
      identityStatus: "verified",
      hasApprovedVenue: true,
      approvedVenueIds: ["v1"],
      primaryVenueId: "v1",
      isVerified: true,
      tier: "free",
      verifiedAt: new Date(),
      isPaused: false,
      canBrowseFull: true,
      canViewTopTalentFull: false,
      billingAccessMode: "enforced",
    });

    await GET(requestWithQuery("bartender"));

    expect(mockedValidate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "bartender",
        maxPay: "20000",
      })
    );
  });
});
