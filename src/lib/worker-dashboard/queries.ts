import { and, countDistinct, desc, eq, gte, isNull, ne, or, sql } from "drizzle-orm";
import {
  db,
  profileInterests,
  profileViews,
  recruiterOpenings,
  recruiterProfiles,
  users,
  workerProfiles,
} from "@/lib/db";
import { getPendingConfirmationRequestsForWorker } from "@/lib/hire-outcomes/queries";
import {
  resolveOpeningContext,
  resolveVenueName,
} from "@/lib/hire-outcomes/confirmations";
import {
  formatOpeningPay,
  joinOpeningContextAndPay,
} from "@/lib/recruiter-profile/opening-pay";
import { getPhotoCountsForWorker } from "@/lib/moderation/photo-moderation";
import { checkPhotoLimits, MAX_PROFILE_PHOTOS } from "@/lib/moderation/photo-policy";
import { hasApprovedPrimaryProfileImage } from "@/lib/media/photo-persistence";
import { toPublicVenueLogoUrl } from "@/lib/media/venue-logo";
import {
  DASHBOARD_RECENT_INTEREST_LIMIT,
  emptyDashboardStats,
  emptyPhotoSlots,
  profileViewWindowStart,
  toSlotCount,
  type WorkerDashboardData,
  type WorkerDashboardPhotoSlots,
  type WorkerDashboardProfile,
  type WorkerDashboardRecentInterest,
  type WorkerDashboardStats,
  type WorkerDashboardViewStats,
} from "./types";

function toCount(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getWorkerProfileViewStats(
  workerProfileId: string,
  workerUserId: string,
  now: Date = new Date()
): Promise<WorkerDashboardViewStats> {
  const startDate = profileViewWindowStart(now);

  const [eventResult] = await db
    .select({
      viewCount: sql<number>`count(*)::int`,
    })
    .from(profileViews)
    .where(
      and(
        eq(profileViews.workerProfileId, workerProfileId),
        gte(profileViews.viewedAt, startDate),
        or(
          isNull(profileViews.viewerUserId),
          ne(profileViews.viewerUserId, workerUserId)
        )
      )
    );

  const [uniqueResult] = await db
    .select({
      uniqueViewCount: countDistinct(profileViews.viewerUserId),
    })
    .from(profileViews)
    .where(
      and(
        eq(profileViews.workerProfileId, workerProfileId),
        gte(profileViews.viewedAt, startDate),
        sql`${profileViews.viewerUserId} IS NOT NULL`,
        ne(profileViews.viewerUserId, workerUserId)
      )
    );

  return {
    windowDays: 30,
    viewEventsLast30Days: toCount(eventResult?.viewCount),
    uniqueRecruiterViewersLast30Days: toCount(uniqueResult?.uniqueViewCount),
  };
}

export async function getWorkerInterestReceivedCount(
  workerProfileId: string
): Promise<number> {
  const [result] = await db
    .select({
      interestCount: sql<number>`count(*)::int`,
    })
    .from(profileInterests)
    .where(eq(profileInterests.workerProfileId, workerProfileId));

  return toCount(result?.interestCount);
}

export async function getWorkerReceivedInterests(
  workerProfileId: string,
  limit: number = DASHBOARD_RECENT_INTEREST_LIMIT
): Promise<WorkerDashboardRecentInterest[]> {
  const rows = await db
    .select({
      id: profileInterests.id,
      message: profileInterests.message,
      createdAt: profileInterests.createdAt,
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
    .from(profileInterests)
    .innerJoin(users, eq(profileInterests.recruiterUserId, users.id))
    .leftJoin(
      recruiterProfiles,
      eq(recruiterProfiles.userId, profileInterests.recruiterUserId)
    )
    .leftJoin(
      recruiterOpenings,
      eq(profileInterests.openingId, recruiterOpenings.id)
    )
    .where(eq(profileInterests.workerProfileId, workerProfileId))
    .orderBy(desc(profileInterests.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
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
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  }));
}

export function toDashboardSafeProfile(profile: {
  photoUrl: string | null;
  photoKey: string | null;
  displayName: string;
  location: string | null;
  availability: string[];
  bio: string | null;
  jobRoles: string[] | null;
  experience: string | null;
  experienceYears: number | null;
  languages: string[] | null;
  lineId: string | null;
  whatsappNumber: string | null;
  phoneNumber: string | null;
  isPublished: boolean;
  isVerified: boolean;
  verificationStatus: WorkerDashboardProfile["verificationStatus"];
  hasSubmittedPhoto: boolean;
}): WorkerDashboardProfile {
  return {
    photoUrl: profile.photoUrl,
    displayName: profile.displayName,
    location: profile.location,
    availability: profile.availability ?? [],
    bio: profile.bio,
    jobRoles: profile.jobRoles,
    experience: profile.experience,
    experienceYears: profile.experienceYears,
    languages: profile.languages,
    lineId: profile.lineId,
    whatsappNumber: profile.whatsappNumber,
    phoneNumber: profile.phoneNumber,
    isPublished: profile.isPublished,
    isVerified: profile.isVerified,
    verificationStatus: profile.verificationStatus,
    hasSubmittedPhoto: profile.hasSubmittedPhoto,
    hasApprovedPrimaryPhoto: hasApprovedPrimaryProfileImage(profile),
  };
}

export function buildPhotoSlots(input: {
  approvedCount: number;
  pendingCount: number;
  isVerified: boolean;
  hasApprovedPrimary: boolean;
}): WorkerDashboardPhotoSlots {
  const approvedCount = toCount(input.approvedCount);
  const pendingCount = toCount(input.pendingCount);
  const slotCount = toSlotCount(approvedCount, pendingCount);
  const remainingSlots = Math.max(0, MAX_PROFILE_PHOTOS - slotCount);
  const galleryLimit = checkPhotoLimits(approvedCount, pendingCount, {
    purpose: "gallery",
    isVerified: input.isVerified,
    hasApprovedPrimary: input.hasApprovedPrimary,
  });

  return {
    approvedCount,
    pendingCount,
    slotCount,
    maxSlots: MAX_PROFILE_PHOTOS,
    remainingSlots,
    canAddGalleryPhoto: galleryLimit.canUpload,
  };
}

export function toDashboardStats(
  views: WorkerDashboardViewStats,
  interestReceivedCount: number
): WorkerDashboardStats {
  return {
    profileViewsLast30Days: views.uniqueRecruiterViewersLast30Days,
    profileViewEventsLast30Days: views.viewEventsLast30Days,
    uniqueRecruiterViewersLast30Days: views.uniqueRecruiterViewersLast30Days,
    interestReceivedCount,
  };
}

export async function getWorkerDashboardData(
  workerUserId: string
): Promise<WorkerDashboardData> {
  const [profile] = await db
    .select({
      photoUrl: workerProfiles.photoUrl,
      photoKey: workerProfiles.photoKey,
      displayName: workerProfiles.displayName,
      location: workerProfiles.location,
      availability: workerProfiles.availability,
      bio: workerProfiles.bio,
      jobRoles: workerProfiles.jobRoles,
      experience: workerProfiles.experience,
      experienceYears: workerProfiles.experienceYears,
      languages: workerProfiles.languages,
      lineId: workerProfiles.lineId,
      whatsappNumber: workerProfiles.whatsappNumber,
      phoneNumber: workerProfiles.phoneNumber,
      isPublished: workerProfiles.isPublished,
      isVerified: workerProfiles.isVerified,
      verificationStatus: workerProfiles.verificationStatus,
      profileId: workerProfiles.id,
    })
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, workerUserId))
    .limit(1);

  if (!profile) {
    return {
      profile: null,
      stats: emptyDashboardStats(),
      recentInterests: [],
      interestReceivedCount: 0,
      pendingConfirmations: [],
      photoSlots: emptyPhotoSlots(false),
      verificationStatus: "unverified",
      isPublished: false,
      hasApprovedPrimaryPhoto: false,
    };
  }

  const isVerified =
    profile.verificationStatus === "verified" || profile.isVerified;

  const [
    viewStats,
    interestReceivedCount,
    recentInterests,
    pendingConfirmations,
    photoCounts,
  ] = await Promise.all([
    getWorkerProfileViewStats(profile.profileId, workerUserId),
    getWorkerInterestReceivedCount(profile.profileId),
    getWorkerReceivedInterests(profile.profileId),
    getPendingConfirmationRequestsForWorker(workerUserId),
    getPhotoCountsForWorker(profile.profileId),
  ]);

  return {
    profile: toDashboardSafeProfile({
      ...profile,
      hasSubmittedPhoto:
        Boolean(profile.photoUrl) ||
        photoCounts.approved > 0 ||
        photoCounts.pending > 0,
    }),
    stats: toDashboardStats(viewStats, interestReceivedCount),
    recentInterests,
    interestReceivedCount,
    pendingConfirmations: pendingConfirmations.map((request) => ({
      id: request.id,
      requestedStatus: request.requestedStatus,
      requestedAt: request.requestedAt.toISOString(),
      venueName: request.venueName,
      logoUrl: request.logoUrl,
      openingContext: request.openingContext,
    })),
    photoSlots: buildPhotoSlots({
      approvedCount: photoCounts.approved,
      pendingCount: photoCounts.pending,
      isVerified,
      hasApprovedPrimary: hasApprovedPrimaryProfileImage(profile),
    }),
    verificationStatus: profile.verificationStatus,
    isPublished: profile.isPublished,
    hasApprovedPrimaryPhoto: hasApprovedPrimaryProfileImage(profile),
  };
}
