import { and, eq, gt, isNotNull } from "drizzle-orm";
import { db, type AppDatabase, type DbClient } from "@/lib/db";
import {
  profilePhotos,
  recruiterProfiles,
  users,
  venues,
  verificationEvents,
  workerProfiles,
} from "@/lib/db/schema";
import {
  applySelfDeletionRequest,
  cancelAccountDeletion,
} from "@/lib/admin/account-moderation";
import { deleteFile, deletePrivateFile } from "@/lib/storage/s3";
import {
  ACCOUNT_DELETION_CONFIRM_PHRASE,
  ACCOUNT_PURGE_DAYS,
  MS_PER_DAY,
} from "./constants";

export interface AccountDeletionResult {
  ok: true;
}

export interface AccountDeletionFailure {
  ok: false;
  status: number;
  error: string;
}

export function isAccountDeletionConfirmPhrase(phrase: string): boolean {
  return phrase.trim() === ACCOUNT_DELETION_CONFIRM_PHRASE;
}

export function isUserDueForAccountPurge(
  deletionRequestedAt: Date | null,
  now: Date
): boolean {
  if (!deletionRequestedAt) {
    return false;
  }
  const cutoff = now.getTime() - ACCOUNT_PURGE_DAYS * MS_PER_DAY;
  return deletionRequestedAt.getTime() < cutoff;
}

export async function requestAccountDeletion(input: {
  userId: string;
  email: string;
  confirmPhrase: string;
  now?: Date;
  client?: AppDatabase;
}): Promise<AccountDeletionResult | AccountDeletionFailure> {
  if (!isAccountDeletionConfirmPhrase(input.confirmPhrase)) {
    return {
      ok: false,
      status: 400,
      error: `Type ${ACCOUNT_DELETION_CONFIRM_PHRASE} to confirm.`,
    };
  }

  const now = input.now ?? new Date();
  const database = input.client ?? db;
  return database.transaction(async (tx) =>
    applySelfDeletionRequest(tx as DbClient, {
      userId: input.userId,
      email: input.email,
      now,
    })
  );
}

export async function cancelAccountDeletionRequest(input: {
  targetUserId: string;
  actorUserId: string;
  actorEmail: string;
  now?: Date;
  client?: AppDatabase;
}): Promise<AccountDeletionResult | AccountDeletionFailure> {
  const now = input.now ?? new Date();
  const database = input.client ?? db;
  return database.transaction(async (tx) =>
    cancelAccountDeletion(tx as DbClient, {
      targetUserId: input.targetUserId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      now,
    })
  );
}

export interface AccountPurgeUser {
  id: string;
  deletionRequestedAt: Date | null;
}

export interface AccountPurgeStore {
  listUsers(
    limit: number,
    afterId: string | null
  ): Promise<AccountPurgeUser[]>;
  listMediaKeys(userId: string): Promise<string[]>;
  listPrivateMediaKeys(userId: string): Promise<string[]>;
  deleteUser(userId: string): Promise<void>;
}

export interface AccountPurgeCounts {
  usersPurged: number;
  mediaObjectsDeleted: number;
  mediaErrors: number;
}

export async function runAccountPurge(
  now: Date = new Date(),
  options: {
    batchSize?: number;
    store?: AccountPurgeStore;
    deletePublicObject?: (key: string) => Promise<void>;
    deletePrivateObject?: (key: string) => Promise<void>;
  } = {}
): Promise<AccountPurgeCounts> {
  const batchSize = options.batchSize ?? 500;
  const store = options.store ?? createDrizzleAccountPurgeStore();
  const deletePublicObject = options.deletePublicObject ?? deleteFile;
  const deletePrivateObject = options.deletePrivateObject ?? deletePrivateFile;
  const counts: AccountPurgeCounts = {
    usersPurged: 0,
    mediaObjectsDeleted: 0,
    mediaErrors: 0,
  };
  let afterId: string | null = null;

  for (;;) {
    const page = await store.listUsers(batchSize, afterId);
    if (page.length === 0) {
      return counts;
    }
    afterId = page[page.length - 1]?.id ?? afterId;
    for (const user of page) {
      if (!isUserDueForAccountPurge(user.deletionRequestedAt, now)) {
        continue;
      }
      const publicKeys = await store.listMediaKeys(user.id);
      const privateKeys = await store.listPrivateMediaKeys(user.id);
      let mediaFailed = false;
      for (const key of publicKeys) {
        try {
          await deletePublicObject(key);
          counts.mediaObjectsDeleted += 1;
        } catch (error) {
          mediaFailed = true;
          counts.mediaErrors += 1;
          console.error(
            "[Account purge] media delete failed:",
            error instanceof Error ? error.message : "unknown"
          );
        }
      }
      for (const key of privateKeys) {
        try {
          await deletePrivateObject(key);
          counts.mediaObjectsDeleted += 1;
        } catch (error) {
          mediaFailed = true;
          counts.mediaErrors += 1;
          console.error(
            "[Account purge] private media delete failed:",
            error instanceof Error ? error.message : "unknown"
          );
        }
      }
      if (mediaFailed) {
        continue;
      }
      await store.deleteUser(user.id);
      counts.usersPurged += 1;
    }
    if (page.length < batchSize) {
      return counts;
    }
  }
}

function uniqueKeys(keys: Array<string | null | undefined>): string[] {
  return [...new Set(keys.filter((key): key is string => Boolean(key)))];
}

export function createDrizzleAccountPurgeStore(
  client: DbClient = db
): AccountPurgeStore {
  return {
    async listUsers(limit, afterId) {
      const conditions = [isNotNull(users.deletionRequestedAt)];
      if (afterId) {
        conditions.push(gt(users.id, afterId));
      }
      return client
        .select({
          id: users.id,
          deletionRequestedAt: users.deletionRequestedAt,
        })
        .from(users)
        .where(and(...conditions))
        .orderBy(users.id)
        .limit(limit);
    },
    async listMediaKeys(userId) {
      const [photos, worker, recruiter, venueRows] = await Promise.all([
        client
          .select({
            photoKey: profilePhotos.photoKey,
            stagingKey: profilePhotos.stagingKey,
          })
          .from(profilePhotos)
          .where(eq(profilePhotos.userId, userId)),
        client
          .select({ photoKey: workerProfiles.photoKey })
          .from(workerProfiles)
          .where(eq(workerProfiles.userId, userId))
          .limit(1),
        client
          .select({
            logoKey: recruiterProfiles.logoKey,
          })
          .from(recruiterProfiles)
          .where(eq(recruiterProfiles.userId, userId))
          .limit(1),
        client
          .select({ logoKey: venues.logoKey })
          .from(venues)
          .innerJoin(
            recruiterProfiles,
            eq(venues.recruiterProfileId, recruiterProfiles.id)
          )
          .where(eq(recruiterProfiles.userId, userId)),
      ]);

      return uniqueKeys([
        ...photos.flatMap((photo) => [photo.photoKey, photo.stagingKey]),
        worker[0]?.photoKey,
        recruiter[0]?.logoKey,
        ...venueRows.map((venue) => venue.logoKey),
      ]);
    },
    async listPrivateMediaKeys(userId) {
      const [events, worker, recruiter] = await Promise.all([
        client
          .select({
            idDocumentKey: verificationEvents.idDocumentKey,
            idDocumentDeletedAt: verificationEvents.idDocumentDeletedAt,
            livenessVideoKey: verificationEvents.livenessVideoKey,
            livenessVideoDeletedAt: verificationEvents.livenessVideoDeletedAt,
          })
          .from(verificationEvents)
          .where(eq(verificationEvents.userId, userId)),
        client
          .select({
            idDocumentKey: workerProfiles.idDocumentKey,
            livenessVideoKey: workerProfiles.livenessVideoKey,
          })
          .from(workerProfiles)
          .where(eq(workerProfiles.userId, userId))
          .limit(1),
        client
          .select({
            idDocumentKey: recruiterProfiles.idDocumentKey,
            livenessVideoKey: recruiterProfiles.livenessVideoKey,
          })
          .from(recruiterProfiles)
          .where(eq(recruiterProfiles.userId, userId))
          .limit(1),
      ]);

      return uniqueKeys([
        ...events.flatMap((event) => [
          event.idDocumentDeletedAt ? null : event.idDocumentKey,
          event.livenessVideoDeletedAt ? null : event.livenessVideoKey,
        ]),
        worker[0]?.idDocumentKey,
        worker[0]?.livenessVideoKey,
        recruiter[0]?.idDocumentKey,
        recruiter[0]?.livenessVideoKey,
      ]);
    },
    async deleteUser(userId) {
      await client.delete(users).where(eq(users.id, userId));
    },
  };
}
