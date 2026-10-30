import type {
  HireConfirmationRequestedStatus,
  HireConfirmationRequestStatus,
  HireOutcomeStatus,
  WorkerProfile,
} from "@/lib/db/schema";
import {
  mapApprovedPhotosToPublic,
  type PublicWorkerPhoto,
} from "@/lib/worker-profile/public-profile";
import { formatTeaserPayBand } from "@/lib/profile/expected-pay";
import type { RecruiterAccess } from "./index";

export type WorkerPhoto = PublicWorkerPhoto;

/**
 * Recruiter-facing worker profile detail (full). Never includes contact fields or userId.
 */
export interface WorkerProfileDetailFull {
  mode: "full";
  id: string;
  displayName: string;
  photoUrl: string | null;
  photos: WorkerPhoto[];
  location: string | null;
  area: string | null;
  bio: string | null;
  description: string | null;
  jobRoles: string[];
  experience: string | null;
  experienceYears: number | null;
  languages: string[];
  availability: string[];
  expectedPayMin: number | null;
  expectedPayMax: number | null;
  expectedPayPeriod: string | null;
  payCurrency: string | null;
  isVerified: boolean;
  isTopTalent: boolean;
  /** @deprecated Prefer contactRequest */
  hasExpressedInterest: boolean;
  /** @deprecated Prefer contactRequest */
  interestId?: string;
  contactRequest: { id: string; status: string } | null;
  hireOutcomeStatus?: HireOutcomeStatus;
  hiredAt?: string | null;
  startedAt?: string | null;
  confirmationRequest?: {
    id: string;
    requestedStatus: HireConfirmationRequestedStatus;
    requestStatus: HireConfirmationRequestStatus;
    requestedAt: string;
  } | null;
}

/**
 * Recruiter-facing search result (full). Never includes contact fields or userId.
 */
export interface SearchWorkerResultFull {
  mode: "full";
  id: string;
  displayName: string;
  photoUrl: string | null;
  location: string | null;
  area: string | null;
  bio: string | null;
  jobRoles: string[];
  availability: string[];
  experienceYears: number | null;
  languages: string[];
  expectedPayMin: number | null;
  expectedPayPeriod: string | null;
  payCurrency: string | null;
  isVerified: boolean;
  isTopTalent: boolean;
}

/** Blurred teaser for unverified recruiters, or locked Top Talent without view access. */
export interface WorkerTeaserDto {
  mode: "teaser";
  id: string;
  firstName: string | null;
  /** City, when the worker published one. */
  location: string | null;
  area: string | null;
  jobRoles: string[];
  availability: string[];
  /**
   * Rounded pay floor for locked non-Top-Talent cards.
   * Omitted for locked Top Talent, which shows no pay.
   */
  payBand?: string | null;
  isTopTalent: boolean;
  isVerified: true;
  teaserPhotoPath: string;
}

export type WorkerProfileDetail = WorkerProfileDetailFull | WorkerTeaserDto;
export type SearchWorkerResult = SearchWorkerResultFull | WorkerTeaserDto;

/** @deprecated Prefer WorkerProfileDetailFull; kept for gradual migration. */
export type WorkerProfileDetailFields = Omit<WorkerProfileDetailFull, "mode">;

export interface WorkerProfileDetailExtras {
  isTopTalent: boolean;
  photos: PublicWorkerPhoto[];
  contactRequest?: { id: string; status: string } | null;
  /** @deprecated Prefer contactRequest */
  hasExpressedInterest?: boolean;
  /** @deprecated Prefer contactRequest */
  interestId?: string;
  hireOutcomeStatus?: HireOutcomeStatus | null;
  hiredAt?: Date | string | null;
  startedAt?: Date | string | null;
  confirmationRequest?: {
    id: string;
    requestedStatus: HireConfirmationRequestedStatus;
    requestStatus: HireConfirmationRequestStatus;
    requestedAt: Date | string;
  } | null;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

export function firstNameFromDisplayName(
  displayName: string | null | undefined
): string | null {
  if (!displayName) return null;
  const token = displayName.trim().split(/\s+/)[0];
  return token || null;
}

export function teaserPhotoPathForWorker(workerProfileId: string): string {
  return `/api/workers/${workerProfileId}/teaser-photo`;
}

function teaserFromProfile(
  profile: Pick<
    WorkerProfile,
    | "id"
    | "displayName"
    | "location"
    | "area"
    | "jobRoles"
    | "availability"
    | "expectedPayMin"
    | "expectedPayPeriod"
    | "payCurrency"
  >,
  isTopTalent: boolean
): WorkerTeaserDto {
  return {
    mode: "teaser",
    id: profile.id,
    firstName: firstNameFromDisplayName(profile.displayName),
    location: profile.location,
    area: profile.area,
    jobRoles: (profile.jobRoles as string[]) ?? [],
    availability: profile.availability ?? [],
    ...(isTopTalent
      ? {}
      : {
          payBand: formatTeaserPayBand(
            profile.expectedPayMin,
            profile.payCurrency,
            profile.expectedPayPeriod
          ),
        }),
    isTopTalent,
    isVerified: true,
    teaserPhotoPath: teaserPhotoPathForWorker(profile.id),
  };
}

/**
 * Maps a worker profile row to the recruiter detail DTO (full mode).
 * Contact fields and userId are intentionally omitted.
 */
export function toWorkerProfileDetail(
  profile: WorkerProfile,
  extras: WorkerProfileDetailExtras
): WorkerProfileDetailFull {
  const photos = extras.photos;
  const primary =
    photos.find((item) => item.isCurrentApproved) ?? photos[0] ?? null;

  const contactRequest =
    extras.contactRequest ??
    (extras.hasExpressedInterest && extras.interestId
      ? { id: extras.interestId, status: "accepted" }
      : null);

  const result: WorkerProfileDetailFull = {
    mode: "full",
    id: profile.id,
    displayName: profile.displayName,
    photoUrl: primary?.photoUrl ?? null,
    photos,
    location: profile.location,
    area: profile.area,
    bio: profile.bio,
    description: profile.description,
    jobRoles: (profile.jobRoles as string[]) ?? [],
    experience: profile.experience,
    experienceYears: profile.experienceYears,
    languages: (profile.languages as string[]) ?? [],
    availability: profile.availability ?? [],
    expectedPayMin: profile.expectedPayMin,
    expectedPayMax: profile.expectedPayMax,
    expectedPayPeriod: profile.expectedPayPeriod,
    payCurrency: profile.payCurrency,
    isVerified: profile.isVerified,
    isTopTalent: extras.isTopTalent,
    hasExpressedInterest: contactRequest != null,
    contactRequest,
  };

  if (contactRequest) {
    result.interestId = contactRequest.id;
    result.hireOutcomeStatus = extras.hireOutcomeStatus ?? "interested";
    result.hiredAt = toIsoString(extras.hiredAt);
    result.startedAt = toIsoString(extras.startedAt);
    result.confirmationRequest = extras.confirmationRequest
      ? {
          id: extras.confirmationRequest.id,
          requestedStatus: extras.confirmationRequest.requestedStatus,
          requestStatus: extras.confirmationRequest.requestStatus,
          requestedAt:
            typeof extras.confirmationRequest.requestedAt === "string"
              ? extras.confirmationRequest.requestedAt
              : extras.confirmationRequest.requestedAt.toISOString(),
        }
      : null;
  }

  return result;
}

/**
 * Maps a worker profile row to the recruiter search DTO (full mode).
 * Contact fields and userId are intentionally omitted.
 */
export function toSearchWorkerResult(
  profile: WorkerProfile,
  isTopTalent: boolean
): SearchWorkerResultFull {
  return {
    mode: "full",
    id: profile.id,
    displayName: profile.displayName,
    photoUrl: profile.photoUrl,
    location: profile.location,
    area: profile.area,
    bio: profile.bio,
    jobRoles: (profile.jobRoles as string[]) ?? [],
    availability: profile.availability ?? [],
    experienceYears: profile.experienceYears,
    languages: (profile.languages as string[]) ?? [],
    expectedPayMin: profile.expectedPayMin,
    expectedPayPeriod: profile.expectedPayPeriod,
    payCurrency: profile.payCurrency,
    isVerified: profile.verificationStatus === "verified",
    isTopTalent,
  };
}

/**
 * Choose full vs teaser (including locked Top Talent) based on recruiter access.
 */
export function toRecruiterSearchWorkerDto(
  profile: WorkerProfile,
  access: Pick<RecruiterAccess, "canBrowseFull" | "canViewTopTalentFull">,
  isTopTalent: boolean
): SearchWorkerResult {
  if (isTopTalent && !access.canViewTopTalentFull) {
    return teaserFromProfile(profile, true);
  }
  if (!access.canBrowseFull) {
    return teaserFromProfile(profile, isTopTalent);
  }
  return toSearchWorkerResult(profile, isTopTalent);
}

/**
 * Choose full vs teaser for a profile detail response.
 * Callers must not load hire/interest data or record views when this returns teaser.
 */
export function resolveWorkerDetailMode(
  access: Pick<RecruiterAccess, "canBrowseFull" | "canViewTopTalentFull">,
  isTopTalent: boolean
): "full" | "teaser" | "locked_top_talent" {
  if (isTopTalent && !access.canViewTopTalentFull) {
    return "locked_top_talent";
  }
  if (!access.canBrowseFull) {
    return "teaser";
  }
  return "full";
}

export function toRecruiterWorkerTeaserDto(
  profile: Pick<
    WorkerProfile,
    | "id"
    | "displayName"
    | "location"
    | "area"
    | "jobRoles"
    | "availability"
    | "expectedPayMin"
    | "expectedPayPeriod"
    | "payCurrency"
  >,
  isTopTalent: boolean
): WorkerTeaserDto {
  return teaserFromProfile(profile, isTopTalent);
}

export { mapApprovedPhotosToPublic };
