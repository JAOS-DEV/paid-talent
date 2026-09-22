import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  getInterestContextForWorker,
  getInterestsForWorkerProfile,
  getRecruiterVenueInfo,
} from "../context";
import {
  listWorkerInterestContexts,
  loadWorkerVenueView,
} from "../worker-display";
import type { InterestContextForWorker, RecruiterVenueInfo } from "../context";

vi.mock("../context", () => ({
  getInterestContextForWorker: vi.fn(),
  getInterestsForWorkerProfile: vi.fn(),
  getRecruiterVenueInfo: vi.fn(),
}));

const WORKER_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "44444444-4444-4444-8444-444444444444";
const INTEREST_NEW = "33333333-3333-4333-8333-333333333333";
const INTEREST_OLD = "33333333-3333-4333-8333-333333333334";
const RECRUITER_ID = "99999999-9999-4999-8999-999999999999";

function interest(
  id: string,
  createdAt: string
): InterestContextForWorker {
  return {
    interestId: id,
    recruiter: {
      recruiterUserId: RECRUITER_ID,
      displayName: "Recruiter",
      venueName: "Sky Bar",
      logoUrl: null,
      area: "Sukhumvit",
      subArea: null,
      blurbSnippet: "Rooftop",
    },
    opening: null,
    message: null,
    createdAt: new Date(createdAt),
  };
}

function venue(overrides: Partial<RecruiterVenueInfo> = {}): RecruiterVenueInfo {
  return {
    recruiterUserId: RECRUITER_ID,
    displayName: "Recruiter",
    venueName: "Sky Bar",
    logoUrl: null,
    area: "Sukhumvit",
    subArea: "Soi 11",
    blurb: "A rooftop bar.",
    hasProfile: true,
    openings: [],
    ...overrides,
  };
}

function mockProfileLookup(rows: Array<{ id: string }>): void {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  vi.mocked(db.select).mockReturnValue({ from } as never);
}

describe("worker interest venue display", () => {
  beforeEach(() => {
    vi.mocked(db.select).mockReset();
    vi.mocked(getInterestContextForWorker).mockReset();
    vi.mocked(getInterestsForWorkerProfile).mockReset();
    vi.mocked(getRecruiterVenueInfo).mockReset();
  });

  it("returns no interests when the worker has no profile", async () => {
    mockProfileLookup([]);
    const result = await listWorkerInterestContexts(WORKER_ID);
    expect(result).toEqual([]);
    expect(getInterestsForWorkerProfile).not.toHaveBeenCalled();
  });

  it("lists only that worker's interests, newest first", async () => {
    mockProfileLookup([{ id: PROFILE_ID }]);
    vi.mocked(getInterestsForWorkerProfile).mockResolvedValue([
      interest(INTEREST_OLD, "2026-01-01T00:00:00.000Z"),
      interest(INTEREST_NEW, "2026-03-01T00:00:00.000Z"),
    ]);

    const result = await listWorkerInterestContexts(WORKER_ID);
    expect(getInterestsForWorkerProfile).toHaveBeenCalledWith(
      PROFILE_ID,
      WORKER_ID
    );
    expect(result.map((item) => item.interestId)).toEqual([
      INTEREST_NEW,
      INTEREST_OLD,
    ]);
  });

  it("hides another worker's interest instead of loading the venue", async () => {
    vi.mocked(getInterestContextForWorker).mockResolvedValue(null);
    const result = await loadWorkerVenueView(INTEREST_NEW, WORKER_ID);
    expect(result).toEqual({ status: "missing" });
    expect(getRecruiterVenueInfo).not.toHaveBeenCalled();
  });

  it("reports a deleted venue profile as unavailable", async () => {
    vi.mocked(getInterestContextForWorker).mockResolvedValue(
      interest(INTEREST_NEW, "2026-03-01T00:00:00.000Z")
    );
    vi.mocked(getRecruiterVenueInfo).mockResolvedValue(
      venue({ hasProfile: false, venueName: null, openings: [] })
    );

    const result = await loadWorkerVenueView(INTEREST_NEW, WORKER_ID);
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns published openings for the interested venue without a directory lookup", async () => {
    vi.mocked(getInterestContextForWorker).mockResolvedValue(
      interest(INTEREST_NEW, "2026-03-01T00:00:00.000Z")
    );
    vi.mocked(getRecruiterVenueInfo).mockResolvedValue(
      venue({
        openings: [
          {
            openingId: "55555555-5555-4555-8555-555555555555",
            role: "Bartender",
            area: "Sukhumvit",
            payMin: 1500,
            payMax: null,
            payCurrency: "THB",
            payPeriod: "night",
          },
        ],
      })
    );

    const result = await loadWorkerVenueView(INTEREST_NEW, WORKER_ID);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.venueName).toBe("Sky Bar");
    expect(result.areaLabel).toBe("Sukhumvit · Soi 11");
    expect(result.openings).toHaveLength(1);
    expect(result.openings[0]?.payMin).toBe(1500);
  });
});
