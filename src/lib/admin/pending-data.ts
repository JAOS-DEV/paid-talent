import { db, workerProfiles, users, profilePhotos } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  getSignedIdDocumentUrl,
  getSignedLivenessVideoUrl,
} from "@/lib/storage/s3";
import { formatChallengeCodeForDisplay } from "@/lib/verification";

export interface PendingPhotoItem {
  id: string;
  userId: string;
  workerProfileId: string;
  photoUrl: string;
  moderationReason: string | null;
  moderationConfidence: number | null;
  moderationCategories: string[] | null;
  createdAt: Date;
  worker: {
    displayName: string;
    email: string | null;
  };
}

export async function listPendingWorkersForAdmin(): Promise<{
  workers: Array<{
    id: string;
    userId: string;
    displayName: string;
    email: string | null;
    location: string | null;
    area: string | null;
    verificationStatus: string;
    idDocumentSubmittedAt: Date | null;
    createdAt: Date;
    hasIdDocument: boolean;
    hasLivenessVideo: boolean;
    hasChallengeCode: boolean;
    challengeCode: string | null;
    challengeCodeDisplay: string | null;
    challengeIssuedAt: Date | null;
    idDocumentUrl: string | null;
    livenessVideoUrl: string | null;
    canApprove: boolean;
  }>;
  count: number;
}> {
  const pendingWorkers = await db
    .select({
      id: workerProfiles.id,
      userId: workerProfiles.userId,
      displayName: workerProfiles.displayName,
      email: users.email,
      location: workerProfiles.location,
      area: workerProfiles.area,
      verificationStatus: workerProfiles.verificationStatus,
      idDocumentKey: workerProfiles.idDocumentKey,
      livenessVideoKey: workerProfiles.livenessVideoKey,
      challengeCode: workerProfiles.challengeCode,
      challengeIssuedAt: workerProfiles.challengeIssuedAt,
      idDocumentSubmittedAt: workerProfiles.idDocumentSubmittedAt,
      createdAt: workerProfiles.createdAt,
    })
    .from(workerProfiles)
    .innerJoin(users, eq(workerProfiles.userId, users.id))
    .where(eq(workerProfiles.verificationStatus, "pending"))
    .orderBy(workerProfiles.idDocumentSubmittedAt);

  const workers = await Promise.all(
    pendingWorkers.map(async (worker) => {
      let idDocumentUrl: string | null = null;
      let livenessVideoUrl: string | null = null;

      if (worker.idDocumentKey) {
        try {
          idDocumentUrl = await getSignedIdDocumentUrl(
            worker.idDocumentKey,
            900
          );
        } catch {
          console.warn(
            `[Admin Pending] Could not generate URL for ID document: ${worker.idDocumentKey}`
          );
        }
      }

      if (worker.livenessVideoKey) {
        try {
          livenessVideoUrl = await getSignedLivenessVideoUrl(
            worker.livenessVideoKey,
            900
          );
        } catch {
          console.warn(
            `[Admin Pending] Could not generate URL for liveness video: ${worker.livenessVideoKey}`
          );
        }
      }

      return {
        id: worker.id,
        userId: worker.userId,
        displayName: worker.displayName,
        email: worker.email,
        location: worker.location,
        area: worker.area,
        verificationStatus: worker.verificationStatus,
        idDocumentSubmittedAt: worker.idDocumentSubmittedAt,
        createdAt: worker.createdAt,
        hasIdDocument: !!worker.idDocumentKey,
        hasLivenessVideo: !!worker.livenessVideoKey,
        hasChallengeCode: !!worker.challengeCode,
        challengeCode: worker.challengeCode,
        challengeCodeDisplay: worker.challengeCode
          ? formatChallengeCodeForDisplay(worker.challengeCode)
          : null,
        challengeIssuedAt: worker.challengeIssuedAt,
        idDocumentUrl,
        livenessVideoUrl,
        canApprove:
          !!worker.idDocumentKey &&
          !!worker.livenessVideoKey &&
          !!worker.challengeCode,
      };
    })
  );

  return { workers, count: workers.length };
}

export async function listPendingPhotosForAdmin(): Promise<{
  photos: PendingPhotoItem[];
  count: number;
}> {
  const pendingPhotos = await db
    .select({
      id: profilePhotos.id,
      userId: profilePhotos.userId,
      workerProfileId: profilePhotos.workerProfileId,
      photoUrl: profilePhotos.photoUrl,
      moderationReason: profilePhotos.moderationReason,
      moderationConfidence: profilePhotos.moderationConfidence,
      moderationCategories: profilePhotos.moderationCategories,
      createdAt: profilePhotos.createdAt,
      workerDisplayName: workerProfiles.displayName,
      workerEmail: users.email,
    })
    .from(profilePhotos)
    .innerJoin(
      workerProfiles,
      eq(profilePhotos.workerProfileId, workerProfiles.id)
    )
    .innerJoin(users, eq(profilePhotos.userId, users.id))
    .where(eq(profilePhotos.moderationStatus, "pending"))
    .orderBy(profilePhotos.createdAt);

  const photos = pendingPhotos.map((photo) => ({
    id: photo.id,
    userId: photo.userId,
    workerProfileId: photo.workerProfileId,
    photoUrl: photo.photoUrl,
    moderationReason: photo.moderationReason,
    moderationConfidence: photo.moderationConfidence,
    moderationCategories: photo.moderationCategories as string[] | null,
    createdAt: photo.createdAt,
    worker: {
      displayName: photo.workerDisplayName,
      email: photo.workerEmail,
    },
  }));

  return { photos, count: photos.length };
}
