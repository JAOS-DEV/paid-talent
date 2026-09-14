import { db, workerProfiles, users, profilePhotos } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  getSignedIdDocumentUrl,
  getSignedLivenessVideoUrl,
  getSignedPhotoStagingUrlForAdmin,
} from "@/lib/storage/s3";
import {
  PRIVATE_SIGNED_GET_MAX_SECONDS,
  PrivateStorageConfigError,
} from "@/lib/storage/config";
import { formatChallengeCodeForDisplay } from "@/lib/verification";

export interface PendingPhotoItem {
  id: string;
  userId: string;
  workerProfileId: string;
  photoUrl: string | null;
  moderationReason: string | null;
  moderationConfidence: number | null;
  moderationCategories: string[] | null;
  createdAt: Date;
  worker: {
    displayName: string;
    email: string | null;
  };
}

export async function listPendingWorkersForAdmin(options: {
  adminEmail: string;
  includeSignedMedia?: boolean;
}): Promise<{
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
      const includeSignedMedia = options.includeSignedMedia === true;

      if (includeSignedMedia && worker.idDocumentKey) {
        try {
          idDocumentUrl = await getSignedIdDocumentUrl(
            options.adminEmail,
            worker.idDocumentKey,
            300
          );
        } catch (error) {
          if (!(error instanceof PrivateStorageConfigError)) {
            console.warn(
              "[Admin Pending] Could not generate URL for ID document"
            );
          }
        }
      }

      if (includeSignedMedia && worker.livenessVideoKey) {
        try {
          livenessVideoUrl = await getSignedLivenessVideoUrl(
            options.adminEmail,
            worker.livenessVideoKey,
            300
          );
        } catch (error) {
          if (!(error instanceof PrivateStorageConfigError)) {
            console.warn(
              "[Admin Pending] Could not generate URL for liveness video"
            );
          }
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

export async function listPendingPhotosForAdmin(options?: {
  adminEmail?: string;
  includeSignedMedia?: boolean;
}): Promise<{
  photos: PendingPhotoItem[];
  count: number;
}> {
  const pendingPhotos = await db
    .select({
      id: profilePhotos.id,
      userId: profilePhotos.userId,
      workerProfileId: profilePhotos.workerProfileId,
      stagingKey: profilePhotos.stagingKey,
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

  const includeSignedMedia = options?.includeSignedMedia === true;
  const adminEmail = options?.adminEmail;

  const photos = await Promise.all(
    pendingPhotos.map(async (photo) => {
      let photoUrl: string | null = null;

      if (includeSignedMedia && adminEmail && photo.stagingKey) {
        try {
          photoUrl = await getSignedPhotoStagingUrlForAdmin(
            adminEmail,
            photo.stagingKey,
            300
          );
        } catch (error) {
          if (!(error instanceof PrivateStorageConfigError)) {
            console.warn(
              "[Admin Pending] Could not generate URL for staged profile photo"
            );
          }
        }
      }

      return {
        id: photo.id,
        userId: photo.userId,
        workerProfileId: photo.workerProfileId,
        photoUrl,
        moderationReason: photo.moderationReason,
        moderationConfidence: photo.moderationConfidence,
        moderationCategories: photo.moderationCategories as string[] | null,
        createdAt: photo.createdAt,
        worker: {
          displayName: photo.workerDisplayName,
          email: photo.workerEmail,
        },
      };
    })
  );

  return { photos, count: photos.length };
}

async function signedUrlOrNull(
  createUrl: () => Promise<string>
): Promise<string | null> {
  try {
    return await createUrl();
  } catch (error) {
    if (!(error instanceof PrivateStorageConfigError)) {
      console.warn("[Admin Pending] Could not generate signed media URL");
    }
    return null;
  }
}

export async function getPendingWorkerMediaForAdmin(input: {
  workerProfileId: string;
  adminEmail: string;
}): Promise<{
  idDocumentUrl: string | null;
  livenessVideoUrl: string | null;
  expiresIn: number;
} | null> {
  const [worker] = await db
    .select({
      idDocumentKey: workerProfiles.idDocumentKey,
      livenessVideoKey: workerProfiles.livenessVideoKey,
    })
    .from(workerProfiles)
    .where(eq(workerProfiles.id, input.workerProfileId))
    .limit(1);

  if (!worker) {
    return null;
  }

  const idDocumentKey = worker.idDocumentKey;
  const livenessVideoKey = worker.livenessVideoKey;

  const [idDocumentUrl, livenessVideoUrl] = await Promise.all([
    idDocumentKey
      ? signedUrlOrNull(() =>
          getSignedIdDocumentUrl(
            input.adminEmail,
            idDocumentKey,
            PRIVATE_SIGNED_GET_MAX_SECONDS
          )
        )
      : Promise.resolve(null),
    livenessVideoKey
      ? signedUrlOrNull(() =>
          getSignedLivenessVideoUrl(
            input.adminEmail,
            livenessVideoKey,
            PRIVATE_SIGNED_GET_MAX_SECONDS
          )
        )
      : Promise.resolve(null),
  ]);

  return {
    idDocumentUrl,
    livenessVideoUrl,
    expiresIn: PRIVATE_SIGNED_GET_MAX_SECONDS,
  };
}

export async function getPendingPhotoMediaForAdmin(input: {
  photoId: string;
  adminEmail: string;
}): Promise<{ photoUrl: string | null; expiresIn: number } | null> {
  const [photo] = await db
    .select({
      stagingKey: profilePhotos.stagingKey,
    })
    .from(profilePhotos)
    .where(eq(profilePhotos.id, input.photoId))
    .limit(1);

  if (!photo) {
    return null;
  }

  const stagingKey = photo.stagingKey;
  const photoUrl = stagingKey
    ? await signedUrlOrNull(() =>
        getSignedPhotoStagingUrlForAdmin(
          input.adminEmail,
          stagingKey,
          PRIVATE_SIGNED_GET_MAX_SECONDS
        )
      )
    : null;

  return {
    photoUrl,
    expiresIn: PRIVATE_SIGNED_GET_MAX_SECONDS,
  };
}
