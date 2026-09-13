import { db, profileInterests, hireOutcomes, workerProfiles, users } from "@/lib/db";
import type { HireOutcomeStatus } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { HireOutcomeFilter } from "./index";

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
  }));
}
