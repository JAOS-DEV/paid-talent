import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  EMPTY_STATE_COPY,
  resolveOpeningAttachment,
  isOpeningVisibleToWorkers,
  canWorkerAccessInterestContext,
  getPublishedOpeningsForRecruiter,
  getInterestContextForWorker,
  getInterestsForWorkerProfile,
} from "../index";
import { db } from "@/lib/db";

const WORKER_A = "11111111-1111-4111-8111-111111111111";
const WORKER_B = "22222222-2222-4222-8222-222222222222";
const INTEREST_A = "33333333-3333-4333-8333-333333333333";
const PROFILE_A = "44444444-4444-4444-8444-444444444444";
const OPENING_PUBLISHED = "55555555-5555-4555-8555-555555555555";
const OPENING_DRAFT = "66666666-6666-4666-8666-666666666666";
const RECRUITER_PROFILE = "77777777-7777-4777-8777-777777777777";
const OTHER_RECRUITER_PROFILE = "88888888-8888-4888-8888-888888888888";
const RECRUITER_USER = "99999999-9999-4999-8999-999999999999";

function mockLimitResult(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

describe("interest opening attachment authorization", () => {
  it("allows general interests with null openingId", () => {
    const result = resolveOpeningAttachment({
      openingId: null,
      recruiterProfileId: RECRUITER_PROFILE,
      opening: null,
    });
    expect(result).toEqual({ ok: true, openingId: null });
  });

  it("rejects missing openings", () => {
    const result = resolveOpeningAttachment({
      openingId: OPENING_PUBLISHED,
      recruiterProfileId: RECRUITER_PROFILE,
      opening: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("rejects attaching another recruiter's opening", () => {
    const result = resolveOpeningAttachment({
      openingId: OPENING_PUBLISHED,
      recruiterProfileId: RECRUITER_PROFILE,
      opening: {
        id: OPENING_PUBLISHED,
        recruiterProfileId: OTHER_RECRUITER_PROFILE,
        isPublished: true,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toContain("another recruiter");
    }
  });

  it("requires published openings for attachment", () => {
    const result = resolveOpeningAttachment({
      openingId: OPENING_DRAFT,
      recruiterProfileId: RECRUITER_PROFILE,
      opening: {
        id: OPENING_DRAFT,
        recruiterProfileId: RECRUITER_PROFILE,
        isPublished: false,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("published");
    }
  });

  it("accepts owned published openings", () => {
    const result = resolveOpeningAttachment({
      openingId: OPENING_PUBLISHED,
      recruiterProfileId: RECRUITER_PROFILE,
      opening: {
        id: OPENING_PUBLISHED,
        recruiterProfileId: RECRUITER_PROFILE,
        isPublished: true,
      },
    });
    expect(result).toEqual({ ok: true, openingId: OPENING_PUBLISHED });
  });
});

describe("worker interest-context authorization", () => {
  it("denies access when requester does not own the interest profile", () => {
    expect(
      canWorkerAccessInterestContext({
        requestingWorkerUserId: WORKER_A,
        interestOwnerUserId: WORKER_B,
      })
    ).toBe(false);
  });

  it("allows access only for the owning worker", () => {
    expect(
      canWorkerAccessInterestContext({
        requestingWorkerUserId: WORKER_A,
        interestOwnerUserId: WORKER_A,
      })
    ).toBe(true);
  });

  it("denies unauthenticated or missing owner ids", () => {
    expect(
      canWorkerAccessInterestContext({
        requestingWorkerUserId: null,
        interestOwnerUserId: WORKER_A,
      })
    ).toBe(false);
    expect(
      canWorkerAccessInterestContext({
        requestingWorkerUserId: WORKER_A,
        interestOwnerUserId: undefined,
      })
    ).toBe(false);
  });

  it("getInterestContextForWorker returns null for another worker (IDOR)", async () => {
    const selectMock = vi.mocked(db.select);
    selectMock.mockReturnValueOnce(
      mockLimitResult([
        {
          id: INTEREST_A,
          recruiterUserId: RECRUITER_USER,
          workerProfileId: PROFILE_A,
          openingId: null,
          message: "secret",
          createdAt: new Date(),
          workerUserId: WORKER_A,
        },
      ]) as never
    );

    const result = await getInterestContextForWorker(INTEREST_A, WORKER_B);
    expect(result).toBeNull();
  });

  it("getInterestsForWorkerProfile returns empty for another worker's profile id", async () => {
    const selectMock = vi.mocked(db.select);
    selectMock.mockReturnValueOnce(
      mockLimitResult([
        {
          id: PROFILE_A,
          userId: WORKER_A,
        },
      ]) as never
    );

    const result = await getInterestsForWorkerProfile(PROFILE_A, WORKER_B);
    expect(result).toEqual([]);
  });
});

describe("unpublished openings never reach worker-facing queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isOpeningVisibleToWorkers is strict about published flag", () => {
    expect(isOpeningVisibleToWorkers(true)).toBe(true);
    expect(isOpeningVisibleToWorkers(false)).toBe(false);
  });

  it("getPublishedOpeningsForRecruiter filters isPublished === true", async () => {
    const selectMock = vi.mocked(db.select);
    const profileChain = mockLimitResult([{ id: RECRUITER_PROFILE }]);
    const openingsChain = mockLimitResult([
      {
        id: OPENING_PUBLISHED,
        role: "Bartender",
        area: "Sukhumvit",
        payMin: 500,
        payMax: 1000,
        payCurrency: "THB",
        payPeriod: "night",
        isPublished: true,
      },
    ]);

    selectMock
      .mockReturnValueOnce(profileChain as never)
      .mockReturnValueOnce(openingsChain as never);

    const openings = await getPublishedOpeningsForRecruiter(RECRUITER_USER);

    expect(openings).toHaveLength(1);
    expect(openings[0].openingId).toBe(OPENING_PUBLISHED);
    expect(openings[0].payMin).toBe(500);
    expect(openings[0].payMax).toBe(1000);
    expect(openingsChain.where).toHaveBeenCalled();

    const contextSource = readFileSync(
      join(__dirname, "../context.ts"),
      "utf8"
    );
    expect(contextSource).toContain("eq(recruiterOpenings.isPublished, true)");
  });

  it("linked unpublished openings are stripped from worker interest context", async () => {
    const selectMock = vi.mocked(db.select);
    selectMock
      .mockReturnValueOnce(
        mockLimitResult([
          {
            id: INTEREST_A,
            recruiterUserId: RECRUITER_USER,
            workerProfileId: PROFILE_A,
            openingId: OPENING_DRAFT,
            message: null,
            createdAt: new Date("2026-01-01"),
            workerUserId: WORKER_A,
          },
        ]) as never
      )
      .mockReturnValueOnce(
        mockLimitResult([{ name: "Recruiter" }]) as never
      )
      .mockReturnValueOnce(
        mockLimitResult([
          {
            organizationName: "Venue",
            logoUrl: null,
            area: "Sukhumvit",
            subArea: null,
            blurb: "Great venue",
          },
        ]) as never
      )
      .mockReturnValueOnce(
        mockLimitResult([
          {
            id: OPENING_DRAFT,
            role: "Bartender",
            area: "Sukhumvit",
            payMin: 500,
            payMax: 900,
            payCurrency: "THB",
            payPeriod: "night",
            isPublished: false,
          },
        ]) as never
      );

    const result = await getInterestContextForWorker(INTEREST_A, WORKER_A);
    expect(result).not.toBeNull();
    expect(result?.opening).toBeNull();
    expect(result?.recruiter.venueName).toBe("Venue");
  });

  it("published opening pay remains visible to the owning worker", async () => {
    const selectMock = vi.mocked(db.select);
    selectMock
      .mockReturnValueOnce(
        mockLimitResult([
          {
            id: INTEREST_A,
            recruiterUserId: RECRUITER_USER,
            workerProfileId: PROFILE_A,
            openingId: OPENING_PUBLISHED,
            message: "Hi",
            createdAt: new Date("2026-01-01"),
            workerUserId: WORKER_A,
          },
        ]) as never
      )
      .mockReturnValueOnce(
        mockLimitResult([{ name: "Recruiter" }]) as never
      )
      .mockReturnValueOnce(
        mockLimitResult([
          {
            organizationName: "Venue",
            logoUrl: null,
            area: "Sukhumvit",
            subArea: null,
            blurb: "Great venue",
          },
        ]) as never
      )
      .mockReturnValueOnce(
        mockLimitResult([
          {
            id: OPENING_PUBLISHED,
            role: "Hostess",
            area: "Sukhumvit",
            payMin: 800,
            payMax: 1500,
            payCurrency: "THB",
            payPeriod: "night",
            isPublished: true,
          },
        ]) as never
      );

    const result = await getInterestContextForWorker(INTEREST_A, WORKER_A);
    expect(result?.opening).toEqual({
      openingId: OPENING_PUBLISHED,
      role: "Hostess",
      area: "Sukhumvit",
      payMin: 800,
      payMax: 1500,
      payCurrency: "THB",
      payPeriod: "night",
    });
  });
});

describe("schema / migration integrity for opening FK", () => {
  it("deleting an opening sets interest.openingId null (ON DELETE set null)", () => {
    const migration = readFileSync(
      join(process.cwd(), "drizzle/0003_known_firelord.sql"),
      "utf8"
    );
    expect(migration).toMatch(
      /profile_interests_opening_id_recruiter_openings_id_fk[\s\S]*ON DELETE set null/i
    );
  });
});

describe("EMPTY_STATE_COPY", () => {
  it("keeps designer-locked empty state copy", () => {
    expect(EMPTY_STATE_COPY.recruiterNoOpenings).toBe("No openings yet");
    expect(EMPTY_STATE_COPY.recruiterNoOpeningsCta).toBe(
      "Add openings to start hiring"
    );
    expect(EMPTY_STATE_COPY.workerNoOpenings).toBe(
      "No openings at this venue right now"
    );
    expect(EMPTY_STATE_COPY.workerNoInterests).toBe(
      "No interest yet — keep your profile fresh"
    );
  });
});
