import type { ProfilePhoto } from "@/lib/db/schema";
import { hasApprovedPublicPhoto } from "@/lib/media/photo-persistence";

export interface PublicWorkerPhoto {
  id: string;
  photoUrl: string;
  displayOrder: number;
  isCurrentApproved: boolean;
}

/** Contact values shown only on the worker's own preview (never to recruiters). */
export interface OwnWorkerContact {
  lineId: string | null;
  whatsappNumber: string | null;
  phoneNumber: string | null;
}

/**
 * Public profile shape shared by recruiter views and the worker preview shell.
 * Never includes contact details or userId.
 */
export interface PublicWorkerProfileView {
  id: string;
  displayName: string;
  photoUrl: string | null;
  photos: PublicWorkerPhoto[];
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
  /** @deprecated Legacy range max; prefer expectedPayMin + expectedPayPeriod. */
  expectedPayMax: number | null;
  expectedPayPeriod: string | null;
  payCurrency: string | null;
  isVerified: boolean;
  isTopTalent: boolean;
}

/** Worker-only preview DTO: public fields plus private ownContact. */
export interface WorkerOwnPreviewView extends PublicWorkerProfileView {
  ownContact: OwnWorkerContact;
}

export function mapApprovedPhotosToPublic(
  photos: ProfilePhoto[]
): PublicWorkerPhoto[] {
  return photos.flatMap((photo) => {
    if (!hasApprovedPublicPhoto(photo) || !photo.photoUrl) {
      return [];
    }

    return [
      {
        id: photo.id,
        photoUrl: photo.photoUrl,
        displayOrder: photo.displayOrder,
        isCurrentApproved: photo.isCurrentApproved,
      },
    ];
  });
}

export function splitPublicPhotos(
  photos: PublicWorkerPhoto[],
  fallbackPhotoUrl: string | null
): {
  primaryUrl: string | null;
  additional: PublicWorkerPhoto[];
} {
  const withUrls = photos.filter((photo) => Boolean(photo.photoUrl));
  const primary =
    withUrls.find((photo) => photo.isCurrentApproved) ?? withUrls[0] ?? null;
  const additional = primary
    ? withUrls.filter((photo) => photo.id !== primary.id)
    : withUrls;

  return {
    primaryUrl: primary?.photoUrl ?? fallbackPhotoUrl,
    additional,
  };
}

export function buildPublicWorkerProfileView(input: {
  id: string;
  displayName: string;
  photoUrl: string | null;
  photos: PublicWorkerPhoto[];
  location: string | null;
  area: string | null;
  bio: string | null;
  description: string | null;
  jobRoles: string[] | null;
  experience: string | null;
  experienceYears: number | null;
  languages: string[] | null;
  availability: string[] | null;
  expectedPayMin: number | null;
  expectedPayMax?: number | null;
  expectedPayPeriod: string | null;
  payCurrency: string | null;
  isVerified: boolean;
  isTopTalent: boolean;
}): PublicWorkerProfileView {
  return {
    id: input.id,
    displayName: input.displayName,
    photoUrl: input.photoUrl,
    photos: input.photos,
    location: input.location,
    area: input.area,
    bio: input.bio,
    description: input.description,
    jobRoles: input.jobRoles ?? [],
    experience: input.experience,
    experienceYears: input.experienceYears,
    languages: input.languages ?? [],
    availability: input.availability ?? [],
    expectedPayMin: input.expectedPayMin,
    expectedPayMax: input.expectedPayMax ?? null,
    expectedPayPeriod: input.expectedPayPeriod,
    payCurrency: input.payCurrency,
    isVerified: input.isVerified,
    isTopTalent: input.isTopTalent,
  };
}
