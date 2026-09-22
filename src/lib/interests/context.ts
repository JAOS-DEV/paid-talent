import {
  db,
  profileInterests,
  recruiterProfiles,
  recruiterOpenings,
  users,
  workerProfiles,
} from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { toPublicVenueLogoUrl } from "@/lib/media/venue-logo";
import {
  canWorkerAccessInterestContext,
  isOpeningVisibleToWorkers,
} from "./opening-attachment";

export interface RecruiterDisplayContext {
  recruiterUserId: string;
  displayName: string | null;
  venueName: string | null;
  logoUrl: string | null;
  area: string | null;
  subArea: string | null;
  blurbSnippet: string | null;
}

export interface OpeningTag {
  openingId: string;
  role: string;
  area: string;
  payMin: number | null;
  payMax: number | null;
  payCurrency: string;
  payPeriod: string;
}

export interface InterestContextForWorker {
  interestId: string;
  recruiter: RecruiterDisplayContext;
  opening: OpeningTag | null;
  message: string | null;
  createdAt: Date;
}

const BLURB_SNIPPET_LENGTH = 120;

function truncateBlurb(blurb: string | null): string | null {
  if (!blurb) return null;
  if (blurb.length <= BLURB_SNIPPET_LENGTH) return blurb;
  return blurb.slice(0, BLURB_SNIPPET_LENGTH).trim() + "…";
}

function toOpeningTag(openingData: {
  id: string;
  role: string;
  area: string;
  payMin: number | null;
  payMax: number | null;
  payCurrency: string;
  payPeriod: string;
  isPublished: boolean;
}): OpeningTag | null {
  if (!isOpeningVisibleToWorkers(openingData.isPublished)) {
    return null;
  }

  return {
    openingId: openingData.id,
    role: openingData.role,
    area: openingData.area,
    payMin: openingData.payMin,
    payMax: openingData.payMax,
    payCurrency: openingData.payCurrency,
    payPeriod: openingData.payPeriod,
  };
}

/**
 * Returns interest context for the authenticated worker who owns the interest.
 * Other workers (or unauthenticated callers) receive null — no IDOR leak.
 */
export async function getInterestContextForWorker(
  interestId: string,
  requestingWorkerUserId: string
): Promise<InterestContextForWorker | null> {
  if (!requestingWorkerUserId) {
    return null;
  }

  const [interest] = await db
    .select({
      id: profileInterests.id,
      recruiterUserId: profileInterests.recruiterUserId,
      workerProfileId: profileInterests.workerProfileId,
      openingId: profileInterests.openingId,
      message: profileInterests.message,
      createdAt: profileInterests.createdAt,
      workerUserId: workerProfiles.userId,
    })
    .from(profileInterests)
    .innerJoin(
      workerProfiles,
      eq(profileInterests.workerProfileId, workerProfiles.id)
    )
    .where(eq(profileInterests.id, interestId))
    .limit(1);

  if (!interest) return null;

  if (
    !canWorkerAccessInterestContext({
      requestingWorkerUserId,
      interestOwnerUserId: interest.workerUserId,
    })
  ) {
    return null;
  }

  const [user] = await db
    .select({
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, interest.recruiterUserId))
    .limit(1);

  const [profile] = await db
    .select({
      organizationName: recruiterProfiles.organizationName,
      logoUrl: recruiterProfiles.logoUrl,
      area: recruiterProfiles.area,
      subArea: recruiterProfiles.subArea,
      blurb: recruiterProfiles.blurb,
    })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, interest.recruiterUserId))
    .limit(1);

  let opening: OpeningTag | null = null;
  if (interest.openingId) {
    const [openingData] = await db
      .select({
        id: recruiterOpenings.id,
        role: recruiterOpenings.role,
        area: recruiterOpenings.area,
        payMin: recruiterOpenings.payMin,
        payMax: recruiterOpenings.payMax,
        payCurrency: recruiterOpenings.payCurrency,
        payPeriod: recruiterOpenings.payPeriod,
        isPublished: recruiterOpenings.isPublished,
      })
      .from(recruiterOpenings)
      .where(eq(recruiterOpenings.id, interest.openingId))
      .limit(1);

    if (openingData) {
      opening = toOpeningTag(openingData);
    }
  }

  return {
    interestId: interest.id,
    recruiter: {
      recruiterUserId: interest.recruiterUserId,
      displayName: user?.name || null,
      venueName: profile?.organizationName || null,
      logoUrl: toPublicVenueLogoUrl(profile?.logoUrl),
      area: profile?.area || null,
      subArea: profile?.subArea || null,
      blurbSnippet: truncateBlurb(profile?.blurb || null),
    },
    opening,
    message: interest.message,
    createdAt: interest.createdAt,
  };
}

/**
 * Lists interest context for a worker profile only when the requester owns it.
 */
export async function getInterestsForWorkerProfile(
  workerProfileId: string,
  requestingWorkerUserId: string
): Promise<InterestContextForWorker[]> {
  if (!requestingWorkerUserId) {
    return [];
  }

  const [ownedProfile] = await db
    .select({
      id: workerProfiles.id,
      userId: workerProfiles.userId,
    })
    .from(workerProfiles)
    .where(eq(workerProfiles.id, workerProfileId))
    .limit(1);

  if (
    !ownedProfile ||
    !canWorkerAccessInterestContext({
      requestingWorkerUserId,
      interestOwnerUserId: ownedProfile.userId,
    })
  ) {
    return [];
  }

  const interests = await db
    .select({
      id: profileInterests.id,
      recruiterUserId: profileInterests.recruiterUserId,
      openingId: profileInterests.openingId,
      message: profileInterests.message,
      createdAt: profileInterests.createdAt,
    })
    .from(profileInterests)
    .where(eq(profileInterests.workerProfileId, workerProfileId))
    .orderBy(profileInterests.createdAt);

  if (interests.length === 0) return [];

  const recruiterUserIds = [...new Set(interests.map((i) => i.recruiterUserId))];
  const openingIds = interests
    .map((i) => i.openingId)
    .filter((id): id is string => id !== null);

  const allUsers = (
    await Promise.all(
      recruiterUserIds.map((id) =>
        db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, id))
          .limit(1)
      )
    )
  ).flat();

  const usersMap = new Map(allUsers.map((u) => [u.id, u]));

  const profilesData = (
    await Promise.all(
      recruiterUserIds.map((id) =>
        db
          .select({
            userId: recruiterProfiles.userId,
            organizationName: recruiterProfiles.organizationName,
            logoUrl: recruiterProfiles.logoUrl,
            area: recruiterProfiles.area,
            subArea: recruiterProfiles.subArea,
            blurb: recruiterProfiles.blurb,
          })
          .from(recruiterProfiles)
          .where(eq(recruiterProfiles.userId, id))
          .limit(1)
      )
    )
  ).flat();

  const profilesMap = new Map(profilesData.map((p) => [p.userId, p]));

  let openingsMap = new Map<
    string,
    {
      id: string;
      role: string;
      area: string;
      payMin: number | null;
      payMax: number | null;
      payCurrency: string;
      payPeriod: string;
      isPublished: boolean;
    }
  >();

  if (openingIds.length > 0) {
    const openingsData = (
      await Promise.all(
        openingIds.map((id) =>
          db
            .select({
              id: recruiterOpenings.id,
              role: recruiterOpenings.role,
              area: recruiterOpenings.area,
              payMin: recruiterOpenings.payMin,
              payMax: recruiterOpenings.payMax,
              payCurrency: recruiterOpenings.payCurrency,
              payPeriod: recruiterOpenings.payPeriod,
              isPublished: recruiterOpenings.isPublished,
            })
            .from(recruiterOpenings)
            .where(eq(recruiterOpenings.id, id))
            .limit(1)
        )
      )
    ).flat();

    openingsMap = new Map(openingsData.map((o) => [o.id, o]));
  }

  return interests.map((interest) => {
    const user = usersMap.get(interest.recruiterUserId);
    const profile = profilesMap.get(interest.recruiterUserId);
    const openingData = interest.openingId
      ? openingsMap.get(interest.openingId)
      : null;

    return {
      interestId: interest.id,
      recruiter: {
        recruiterUserId: interest.recruiterUserId,
        displayName: user?.name || null,
        venueName: profile?.organizationName || null,
        logoUrl: toPublicVenueLogoUrl(profile?.logoUrl),
        area: profile?.area || null,
        subArea: profile?.subArea || null,
        blurbSnippet: truncateBlurb(profile?.blurb || null),
      },
      opening: openingData ? toOpeningTag(openingData) : null,
      message: interest.message,
      createdAt: interest.createdAt,
    };
  });
}

/**
 * Worker-facing published openings only. Drafts must never appear here.
 */
export async function getPublishedOpeningsForRecruiter(
  recruiterUserId: string
): Promise<OpeningTag[]> {
  const [profile] = await db
    .select({ id: recruiterProfiles.id })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, recruiterUserId))
    .limit(1);

  if (!profile) return [];

  const openings = await db
    .select({
      id: recruiterOpenings.id,
      role: recruiterOpenings.role,
      area: recruiterOpenings.area,
      payMin: recruiterOpenings.payMin,
      payMax: recruiterOpenings.payMax,
      payCurrency: recruiterOpenings.payCurrency,
      payPeriod: recruiterOpenings.payPeriod,
      isPublished: recruiterOpenings.isPublished,
    })
    .from(recruiterOpenings)
    .where(
      and(
        eq(recruiterOpenings.recruiterProfileId, profile.id),
        eq(recruiterOpenings.isPublished, true)
      )
    )
    .orderBy(recruiterOpenings.createdAt);

  return openings
    .map((o) => toOpeningTag(o))
    .filter((o): o is OpeningTag => o !== null);
}

export interface RecruiterVenueInfo {
  recruiterUserId: string;
  displayName: string | null;
  venueName: string | null;
  logoUrl: string | null;
  area: string | null;
  subArea: string | null;
  blurb: string | null;
  /** False when the recruiter user exists but their venue profile row is gone. */
  hasProfile: boolean;
  openings: OpeningTag[];
}

export async function getRecruiterVenueInfo(
  recruiterUserId: string
): Promise<RecruiterVenueInfo | null> {
  const [user] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, recruiterUserId))
    .limit(1);

  if (!user) return null;

  const [profile] = await db
    .select({
      organizationName: recruiterProfiles.organizationName,
      logoUrl: recruiterProfiles.logoUrl,
      area: recruiterProfiles.area,
      subArea: recruiterProfiles.subArea,
      blurb: recruiterProfiles.blurb,
    })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, recruiterUserId))
    .limit(1);

  const openings = await getPublishedOpeningsForRecruiter(recruiterUserId);

  return {
    recruiterUserId,
    displayName: user.name,
    venueName: profile?.organizationName || null,
    logoUrl: toPublicVenueLogoUrl(profile?.logoUrl),
    area: profile?.area || null,
    subArea: profile?.subArea || null,
    blurb: profile?.blurb || null,
    hasProfile: Boolean(profile),
    openings,
  };
}
