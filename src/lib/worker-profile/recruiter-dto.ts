import type {
  HireConfirmationRequestedStatus,
  HireConfirmationRequestStatus,
  HireOutcomeStatus,
  WorkerProfile,
} from "@/lib/db/schema";
import {
  mapApprovedPhotosToPublic,
  type PublicWorkerPhoto,
} from "./public-profile";

export type WorkerPhoto = PublicWorkerPhoto;

/**
 * Recruiter-facing worker profile detail. Never includes contact fields or userId.
 */
export interface WorkerProfileDetail {
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
  hasExpressedInterest: boolean;
  interestId?: string;
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
 * Recruiter-facing search result. Never includes contact fields or userId.
 */
export interface SearchWorkerResult {
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

export interface WorkerProfileDetailExtras {
  isTopTalent: boolean;
  photos: PublicWorkerPhoto[];
  hasExpressedInterest: boolean;
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

/**
 * Maps a worker profile row to the recruiter detail DTO.
 * Contact fields and userId are intentionally omitted.
 */
export function toWorkerProfileDetail(
  profile: WorkerProfile,
  extras: WorkerProfileDetailExtras
): WorkerProfileDetail {
  const photos = extras.photos;
  const primary =
    photos.find((item) => item.isCurrentApproved) ?? photos[0] ?? null;

  const result: WorkerProfileDetail = {
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
    hasExpressedInterest: extras.hasExpressedInterest,
  };

  if (extras.hasExpressedInterest && extras.interestId) {
    result.interestId = extras.interestId;
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
 * Maps a worker profile row to the recruiter search DTO.
 * Contact fields and userId are intentionally omitted.
 */
export function toSearchWorkerResult(
  profile: WorkerProfile,
  isTopTalent: boolean
): SearchWorkerResult {
  return {
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

export { mapApprovedPhotosToPublic };
