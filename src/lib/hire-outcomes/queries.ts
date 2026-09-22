import {
  db,
  profileInterests,
  hireOutcomes,
  hireOutcomeConfirmationRequests,
  workerProfiles,
  users,
  recruiterProfiles,
  recruiterOpenings,
} from "@/lib/db";
import type {
  HireConfirmationRequestStatus,
  HireConfirmationRequestedStatus,
  HireOutcomeStatus,
} from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { HireOutcomeFilter } from "./index";
import {
  pickLatestConfirmationRequest,
  resolveOpeningContext,
  resolveVenueName,
} from "./confirmations";
import {
  formatOpeningPay,
  joinOpeningContextAndPay,
} from "@/lib/recruiter-profile/opening-pay";
import { toPublicVenueLogoUrl } from "@/lib/media/venue-logo";

export interface ConfirmationRequestSummary {
  id: string;
  requestedStatus: HireConfirmationRequestedStatus;
  requestStatus: HireConfirmationRequestStatus;
  requestedAt: Date;
}

export interface InterestWithOutcomeAndProfile {
  id: string;
  workerProfileId: string;
  workerName: string;
  workerPhoto: string | null;
  message: string | null;
  createdAt: Date;
  hireOutcome: {
    id: string;
    status: HireOutcomeStatus;
    hiredAt: Date | null;
    startedAt: Date | null;
    notes: string | null;
  } | null;
  confirmationRequest: ConfirmationRequestSummary | null;
}

async function attachLatestConfirmationRequests<
  T extends { id: string },
>(interests: T[]): Promise<Map<string, ConfirmationRequestSummary>> {
  const latestByInterest = new Map<string, ConfirmationRequestSummary>();
  if (interests.length === 0) {
    return latestByInterest;
  }

  const interestIds = interests.map((interest) => interest.id);
  const requests = await db
    .select({
      id: hireOutcomeConfirmationRequests.id,
      interestId: hireOutcomeConfirmationRequests.interestId,
      requestedStatus: hireOutcomeConfirmationRequests.requestedStatus,
      requestStatus: hireOutcomeConfirmationRequests.requestStatus,
      requestedAt: hireOutcomeConfirmationRequests.requestedAt,
    })
    .from(hireOutcomeConfirmationRequests)
    .where(inArray(hireOutcomeConfirmationRequests.interestId, interestIds))
    .orderBy(desc(hireOutcomeConfirmationRequests.requestedAt));

  const grouped = new Map<string, typeof requests>();
  for (const request of requests) {
    const existing = grouped.get(request.interestId) ?? [];
    existing.push(request);
    grouped.set(request.interestId, existing);
  }

  for (const [interestId, group] of grouped) {
    const latest = pickLatestConfirmationRequest(group);
    if (latest) {
      latestByInterest.set(interestId, {
        id: latest.id,
        requestedStatus: latest.requestedStatus,
        requestStatus: latest.requestStatus,
        requestedAt: latest.requestedAt,
      });
    }
  }

  return latestByInterest;
}

export async function getRecruiterInterestsWithOutcomes(
  recruiterUserId: string,
  filter?: HireOutcomeFilter
): Promise<InterestWithOutcomeAndProfile[]> {
  const query = db
    .select({
      id: profileInterests.id,
      workerProfileId: profileInterests.workerProfileId,
      workerName: workerProfiles.displayName,
      workerPhoto: workerProfiles.photoUrl,
      message: profileInterests.message,
      createdAt: profileInterests.createdAt,
      outcomeId: hireOutcomes.id,
      outcomeStatus: hireOutcomes.status,
      hiredAt: hireOutcomes.hiredAt,
      startedAt: hireOutcomes.startedAt,
      notes: hireOutcomes.notes,
    })
    .from(profileInterests)
    .innerJoin(
      workerProfiles,
      eq(profileInterests.workerProfileId, workerProfiles.id)
    )
    .leftJoin(hireOutcomes, eq(profileInterests.id, hireOutcomes.interestId))
    .where(eq(profileInterests.recruiterUserId, recruiterUserId))
    .orderBy(profileInterests.createdAt);

  const results = await query;

  let filteredResults = results;

  if (filter && filter !== "any") {
    if (filter === "none") {
      filteredResults = results.filter((r) => r.outcomeId === null);
    } else {
      filteredResults = results.filter((r) => r.outcomeStatus === filter);
    }
  }

  const latestRequests = await attachLatestConfirmationRequests(filteredResults);

  return filteredResults.map((r) => ({
    id: r.id,
    workerProfileId: r.workerProfileId,
    workerName: r.workerName,
    workerPhoto: r.workerPhoto,
    message: r.message,
    createdAt: r.createdAt,
    hireOutcome: r.outcomeId
      ? {
          id: r.outcomeId,
          status: r.outcomeStatus!,
          hiredAt: r.hiredAt,
          startedAt: r.startedAt,
          notes: r.notes,
        }
      : null,
    confirmationRequest: latestRequests.get(r.id) ?? null,
  }));
}

export interface OutcomeStats {
  total: number;
  interested: number;
  hired: number;
  started: number;
}

export async function getRecruiterOutcomeStats(
  recruiterUserId: string
): Promise<OutcomeStats> {
  const interests = await db
    .select({
      interestId: profileInterests.id,
      outcomeStatus: hireOutcomes.status,
    })
    .from(profileInterests)
    .leftJoin(hireOutcomes, eq(profileInterests.id, hireOutcomes.interestId))
    .where(eq(profileInterests.recruiterUserId, recruiterUserId));

  const stats: OutcomeStats = {
    total: interests.length,
    interested: 0,
    hired: 0,
    started: 0,
  };

  for (const interest of interests) {
    if (!interest.outcomeStatus || interest.outcomeStatus === "interested") {
      stats.interested++;
    } else if (interest.outcomeStatus === "hired") {
      stats.hired++;
    } else if (interest.outcomeStatus === "started") {
      stats.started++;
    }
  }

  return stats;
}

export async function getInterestsWithHiredStatus(
  recruiterUserId: string
): Promise<InterestWithOutcomeAndProfile[]> {
  return getRecruiterInterestsWithOutcomes(recruiterUserId, "hired");
}

export async function getInterestsWithStartedStatus(
  recruiterUserId: string
): Promise<InterestWithOutcomeAndProfile[]> {
  return getRecruiterInterestsWithOutcomes(recruiterUserId, "started");
}

export async function getInterestsWithNoOutcome(
  recruiterUserId: string
): Promise<InterestWithOutcomeAndProfile[]> {
  return getRecruiterInterestsWithOutcomes(recruiterUserId, "none");
}

export async function getHireOutcomeByInterestId(
  interestId: string
): Promise<typeof hireOutcomes.$inferSelect | null> {
  const [outcome] = await db
    .select()
    .from(hireOutcomes)
    .where(eq(hireOutcomes.interestId, interestId))
    .limit(1);

  return outcome ?? null;
}

export async function getLatestConfirmationRequestForInterest(
  interestId: string
): Promise<ConfirmationRequestSummary | null> {
  const requests = await db
    .select({
      id: hireOutcomeConfirmationRequests.id,
      requestedStatus: hireOutcomeConfirmationRequests.requestedStatus,
      requestStatus: hireOutcomeConfirmationRequests.requestStatus,
      requestedAt: hireOutcomeConfirmationRequests.requestedAt,
    })
    .from(hireOutcomeConfirmationRequests)
    .where(eq(hireOutcomeConfirmationRequests.interestId, interestId))
    .orderBy(desc(hireOutcomeConfirmationRequests.requestedAt));

  return pickLatestConfirmationRequest(requests);
}

export async function getWorkerInterestsWithOutcomes(
  workerProfileId: string
): Promise<
  Array<{
    id: string;
    recruiterName: string | null;
    message: string | null;
    createdAt: Date;
    hireOutcome: {
      status: HireOutcomeStatus;
      hiredAt: Date | null;
      startedAt: Date | null;
    } | null;
    confirmationRequest: ConfirmationRequestSummary | null;
  }>
> {
  const results = await db
    .select({
      id: profileInterests.id,
      recruiterName: users.name,
      message: profileInterests.message,
      createdAt: profileInterests.createdAt,
      outcomeStatus: hireOutcomes.status,
      hiredAt: hireOutcomes.hiredAt,
      startedAt: hireOutcomes.startedAt,
    })
    .from(profileInterests)
    .innerJoin(users, eq(profileInterests.recruiterUserId, users.id))
    .leftJoin(hireOutcomes, eq(profileInterests.id, hireOutcomes.interestId))
    .where(eq(profileInterests.workerProfileId, workerProfileId))
    .orderBy(profileInterests.createdAt);

  const latestRequests = await attachLatestConfirmationRequests(results);

  return results.map((r) => ({
    id: r.id,
    recruiterName: r.recruiterName,
    message: r.message,
    createdAt: r.createdAt,
    hireOutcome: r.outcomeStatus
      ? {
          status: r.outcomeStatus,
          hiredAt: r.hiredAt,
          startedAt: r.startedAt,
        }
      : null,
    confirmationRequest: latestRequests.get(r.id) ?? null,
  }));
}

export interface WorkerPendingConfirmation {
  id: string;
  interestId: string;
  requestedStatus: HireConfirmationRequestedStatus;
  requestedAt: Date;
  venueName: string;
  logoUrl: string | null;
  openingContext: string | null;
}

export async function getPendingConfirmationRequestsForWorker(
  workerUserId: string
): Promise<WorkerPendingConfirmation[]> {
  const results = await db
    .select({
      id: hireOutcomeConfirmationRequests.id,
      interestId: hireOutcomeConfirmationRequests.interestId,
      requestedStatus: hireOutcomeConfirmationRequests.requestedStatus,
      requestedAt: hireOutcomeConfirmationRequests.requestedAt,
      organizationName: recruiterProfiles.organizationName,
      logoUrl: recruiterProfiles.logoUrl,
      recruiterName: users.name,
      openingRole: recruiterOpenings.role,
      openingArea: recruiterOpenings.area,
      payMin: recruiterOpenings.payMin,
      payMax: recruiterOpenings.payMax,
      payCurrency: recruiterOpenings.payCurrency,
      payPeriod: recruiterOpenings.payPeriod,
    })
    .from(hireOutcomeConfirmationRequests)
    .innerJoin(
      profileInterests,
      eq(hireOutcomeConfirmationRequests.interestId, profileInterests.id)
    )
    .innerJoin(
      workerProfiles,
      eq(profileInterests.workerProfileId, workerProfiles.id)
    )
    .innerJoin(users, eq(profileInterests.recruiterUserId, users.id))
    .leftJoin(
      recruiterProfiles,
      eq(recruiterProfiles.userId, profileInterests.recruiterUserId)
    )
    .leftJoin(
      recruiterOpenings,
      eq(profileInterests.openingId, recruiterOpenings.id)
    )
    .where(
      and(
        eq(hireOutcomeConfirmationRequests.requestStatus, "pending"),
        eq(workerProfiles.userId, workerUserId)
      )
    )
    .orderBy(desc(hireOutcomeConfirmationRequests.requestedAt));

  return results.map((row) => ({
    id: row.id,
    interestId: row.interestId,
    requestedStatus: row.requestedStatus,
    requestedAt: row.requestedAt,
    venueName: resolveVenueName(row.organizationName, row.recruiterName),
    logoUrl: toPublicVenueLogoUrl(row.logoUrl),
    openingContext: joinOpeningContextAndPay(
      resolveOpeningContext(row.openingRole, row.openingArea),
      formatOpeningPay({
        payMin: row.payMin,
        payMax: row.payMax,
        payCurrency: row.payCurrency,
        payPeriod: row.payPeriod,
      })
    ),
  }));
}
