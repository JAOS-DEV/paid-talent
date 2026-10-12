import { eq } from "drizzle-orm";
import { db, workerProfiles } from "@/lib/db";
import { getApprovedPhotosForWorker } from "@/lib/moderation/photo-moderation";
import { isProfileTopTalent } from "@/lib/ranking";
import {
  buildPublicWorkerProfileView,
  mapApprovedPhotosToPublic,
  type WorkerOwnPreviewView,
} from "./public-profile";

export async function getOwnWorkerPreview(
  workerUserId: string
): Promise<WorkerOwnPreviewView | null> {
  const [profile] = await db
    .select()
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, workerUserId))
    .limit(1);

  if (!profile) {
    return null;
  }

  const [approvedPhotos, isTopTalent] = await Promise.all([
    getApprovedPhotosForWorker(profile.id),
    isProfileTopTalent(profile.id),
  ]);
  const photos = mapApprovedPhotosToPublic(approvedPhotos);
  const primary =
    photos.find((photo) => photo.isCurrentApproved) ?? photos[0] ?? null;

  const publicView = buildPublicWorkerProfileView({
    id: profile.id,
    displayName: profile.displayName,
    photoUrl: primary?.photoUrl ?? null,
    photos,
    location: profile.location,
    area: profile.area,
    bio: profile.bio,
    description: profile.description,
    jobRoles: profile.jobRoles,
    experience: profile.experience,
    experienceYears: profile.experienceYears,
    languages: profile.languages,
    availability: profile.availability ?? [],
    expectedPayMin: profile.expectedPayMin,
    expectedPayMax: profile.expectedPayMax,
    expectedPayPeriod: profile.expectedPayPeriod,
    payCurrency: profile.payCurrency,
    isVerified: profile.isVerified,
    isTopTalent,
  });

  return {
    ...publicView,
    ownContact: {
      lineId: profile.lineId,
      whatsappNumber: profile.whatsappNumber,
      phoneNumber: profile.phoneNumber,
    },
  };
}
