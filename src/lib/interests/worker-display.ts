import { eq } from "drizzle-orm";
import { db, workerProfiles } from "@/lib/db";
import { resolveVenueName } from "@/lib/hire-outcomes/confirmations";
import {
  getInterestContextForWorker,
  getInterestsForWorkerProfile,
  getRecruiterVenueInfo,
  type InterestContextForWorker,
  type OpeningTag,
} from "./context";
import { formatVenueAreaLabel } from "./venue-label";

export type WorkerVenueView =
  | { status: "missing" }
  | { status: "unavailable" }
  | {
      status: "ready";
      interestId: string;
      venueName: string;
      areaLabel: string | null;
      blurb: string | null;
      logoUrl: string | null;
      openings: OpeningTag[];
    };

/**
 * Interests sent to this worker, newest first.
 * Not a recruiter directory — only venues that already expressed interest.
 */
export async function listWorkerInterestContexts(
  workerUserId: string
): Promise<InterestContextForWorker[]> {
  const [profile] = await db
    .select({ id: workerProfiles.id })
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, workerUserId))
    .limit(1);

  if (!profile) {
    return [];
  }

  const interests = await getInterestsForWorkerProfile(
    profile.id,
    workerUserId
  );

  return [...interests].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  );
}

/**
 * Venue + published openings for one interest the worker owns.
 * Another worker's interest id resolves as missing (no IDOR leak).
 */
export async function loadWorkerVenueView(
  interestId: string,
  workerUserId: string
): Promise<WorkerVenueView> {
  const interest = await getInterestContextForWorker(interestId, workerUserId);
  if (!interest) {
    return { status: "missing" };
  }

  const venue = await getRecruiterVenueInfo(interest.recruiter.recruiterUserId);
  if (!venue?.hasProfile) {
    return { status: "unavailable" };
  }

  return {
    status: "ready",
    interestId: interest.interestId,
    venueName: resolveVenueName(venue.venueName, venue.displayName),
    areaLabel: formatVenueAreaLabel(venue.area, venue.subArea),
    blurb: venue.blurb?.trim() ? venue.blurb.trim() : null,
    logoUrl: venue.logoUrl,
    openings: venue.openings,
  };
}
