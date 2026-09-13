/**
 * Verification Media Retention Job
 *
 * Deletes raw ID document and liveness video files from storage after the
 * retention period expires. This job NEVER deletes verification_events —
 * those are retained permanently for audit compliance.
 *
 * Configuration:
 * - RETENTION_DAYS: Number of days to retain media after decision (default: 30)
 *
 * Note: Interim policy pending legal counsel review.
 */

import { db, verificationEvents, workerProfiles } from "@/lib/db";
import { deletePrivateFile } from "@/lib/storage/s3";
import { lt, isNull, isNotNull, and, eq, or } from "drizzle-orm";

export interface RetentionJobResult {
  processed: number;
  idDocumentsDeleted: number;
  livenessVideosDeleted: number;
  errors: number;
  skipped: number;
  errorDetails: Array<{ eventId: string; fileType: string; error: string }>;
}

export async function runVerificationMediaRetentionJob(): Promise<RetentionJobResult> {
  const now = new Date();

  const result: RetentionJobResult = {
    processed: 0,
    idDocumentsDeleted: 0,
    livenessVideosDeleted: 0,
    errors: 0,
    skipped: 0,
    errorDetails: [],
  };

  const expiredEvents = await db
    .select({
      id: verificationEvents.id,
      idDocumentKey: verificationEvents.idDocumentKey,
      idDocumentDeletedAt: verificationEvents.idDocumentDeletedAt,
      livenessVideoKey: verificationEvents.livenessVideoKey,
      livenessVideoDeletedAt: verificationEvents.livenessVideoDeletedAt,
      workerProfileId: verificationEvents.workerProfileId,
    })
    .from(verificationEvents)
    .where(
      and(
        lt(verificationEvents.retentionExpiresAt, now),
        or(
          and(
            isNotNull(verificationEvents.idDocumentKey),
            isNull(verificationEvents.idDocumentDeletedAt)
          ),
          and(
            isNotNull(verificationEvents.livenessVideoKey),
            isNull(verificationEvents.livenessVideoDeletedAt)
          )
        )
      )
    );

  for (const event of expiredEvents) {
    result.processed++;

    if (event.idDocumentKey && !event.idDocumentDeletedAt) {
      try {
        await deletePrivateFile(event.idDocumentKey);

        await db
          .update(verificationEvents)
          .set({ idDocumentDeletedAt: now })
          .where(eq(verificationEvents.id, event.id));

        if (event.workerProfileId) {
          await db
            .update(workerProfiles)
            .set({
              idDocumentKey: null,
              updatedAt: now,
            })
            .where(
              and(
                eq(workerProfiles.id, event.workerProfileId),
                eq(workerProfiles.idDocumentKey, event.idDocumentKey)
              )
            );
        }

        result.idDocumentsDeleted++;
        console.log(
          `[Retention Job] Deleted ID document for event ${event.id}`
        );
      } catch (error) {
        result.errors++;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        result.errorDetails.push({
          eventId: event.id,
          fileType: "id_document",
          error: errorMessage,
        });
        console.error(
          `[Retention Job] Failed to delete ID document for event ${event.id}:`,
          errorMessage
        );
      }
    }

    if (event.livenessVideoKey && !event.livenessVideoDeletedAt) {
      try {
        await deletePrivateFile(event.livenessVideoKey);

        await db
          .update(verificationEvents)
          .set({ livenessVideoDeletedAt: now })
          .where(eq(verificationEvents.id, event.id));

        if (event.workerProfileId) {
          await db
            .update(workerProfiles)
            .set({
              livenessVideoKey: null,
              updatedAt: now,
            })
            .where(
              and(
                eq(workerProfiles.id, event.workerProfileId),
                eq(workerProfiles.livenessVideoKey, event.livenessVideoKey)
              )
            );
        }

        result.livenessVideosDeleted++;
        console.log(
          `[Retention Job] Deleted liveness video for event ${event.id}`
        );
      } catch (error) {
        result.errors++;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        result.errorDetails.push({
          eventId: event.id,
          fileType: "liveness_video",
          error: errorMessage,
        });
        console.error(
          `[Retention Job] Failed to delete liveness video for event ${event.id}:`,
          errorMessage
        );
      }
    }

    if (!event.idDocumentKey && !event.livenessVideoKey) {
      result.skipped++;
    }
  }

  console.log(
    `[Retention Job] Completed: ${result.idDocumentsDeleted} ID docs deleted, ` +
      `${result.livenessVideosDeleted} videos deleted, ${result.errors} errors, ${result.skipped} skipped`
  );

  return result;
}

export async function getRetentionJobStats(): Promise<{
  pendingIdDeletion: number;
  pendingVideoDeletion: number;
  expiredIdNotDeleted: number;
  expiredVideoNotDeleted: number;
  totalIdDeleted: number;
  totalVideoDeleted: number;
  totalEventsCount: number;
}> {
  const now = new Date();

  const allEvents = await db
    .select({
      id: verificationEvents.id,
      idDocumentKey: verificationEvents.idDocumentKey,
      idDocumentDeletedAt: verificationEvents.idDocumentDeletedAt,
      livenessVideoKey: verificationEvents.livenessVideoKey,
      livenessVideoDeletedAt: verificationEvents.livenessVideoDeletedAt,
      retentionExpiresAt: verificationEvents.retentionExpiresAt,
    })
    .from(verificationEvents);

  let pendingIdDeletion = 0;
  let pendingVideoDeletion = 0;
  let expiredIdNotDeleted = 0;
  let expiredVideoNotDeleted = 0;
  let totalIdDeleted = 0;
  let totalVideoDeleted = 0;

  for (const event of allEvents) {
    if (event.idDocumentKey && event.retentionExpiresAt && !event.idDocumentDeletedAt) {
      pendingIdDeletion++;
      if (event.retentionExpiresAt < now) {
        expiredIdNotDeleted++;
      }
    }
    if (event.idDocumentDeletedAt) {
      totalIdDeleted++;
    }

    if (event.livenessVideoKey && event.retentionExpiresAt && !event.livenessVideoDeletedAt) {
      pendingVideoDeletion++;
      if (event.retentionExpiresAt < now) {
        expiredVideoNotDeleted++;
      }
    }
    if (event.livenessVideoDeletedAt) {
      totalVideoDeleted++;
    }
  }

  return {
    pendingIdDeletion,
    pendingVideoDeletion,
    expiredIdNotDeleted,
    expiredVideoNotDeleted,
    totalIdDeleted,
    totalVideoDeleted,
    totalEventsCount: allEvents.length,
  };
}
