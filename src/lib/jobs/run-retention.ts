#!/usr/bin/env tsx
/**
 * CLI script to run the verification media retention job.
 *
 * Usage:
 *   npx tsx src/lib/jobs/run-retention.ts
 *
 * This job:
 * - Finds verification_events with expired retentionExpiresAt
 * - Deletes the raw ID document and liveness video files from S3
 * - Marks the files as deleted (idDocumentDeletedAt, livenessVideoDeletedAt)
 * - NEVER deletes verification_events rows (kept permanently for audit)
 */

import "../db/load-env";
import {
  runVerificationMediaRetentionJob,
  getRetentionJobStats,
} from "./id-document-retention";

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Verification Media Retention Job");
  console.log("=".repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Retention period: ${process.env.RETENTION_DAYS || 30} days`);
  console.log("");

  console.log("Pre-run stats:");
  const preStats = await getRetentionJobStats();
  console.log(`  - Total events: ${preStats.totalEventsCount}`);
  console.log(`  - ID docs pending deletion: ${preStats.pendingIdDeletion}`);
  console.log(`  - ID docs expired not deleted: ${preStats.expiredIdNotDeleted}`);
  console.log(`  - Videos pending deletion: ${preStats.pendingVideoDeletion}`);
  console.log(`  - Videos expired not deleted: ${preStats.expiredVideoNotDeleted}`);
  console.log(`  - ID docs previously deleted: ${preStats.totalIdDeleted}`);
  console.log(`  - Videos previously deleted: ${preStats.totalVideoDeleted}`);
  console.log("");

  console.log("Running retention job...");
  const result = await runVerificationMediaRetentionJob();
  console.log("");

  console.log("Results:");
  console.log(`  - Events processed: ${result.processed}`);
  console.log(`  - ID documents deleted: ${result.idDocumentsDeleted}`);
  console.log(`  - Liveness videos deleted: ${result.livenessVideosDeleted}`);
  console.log(`  - Errors: ${result.errors}`);
  console.log(`  - Skipped: ${result.skipped}`);

  if (result.errorDetails.length > 0) {
    console.log("");
    console.log("Error details:");
    for (const err of result.errorDetails) {
      console.log(`  - Event ${err.eventId} (${err.fileType}): ${err.error}`);
    }
  }

  console.log("");
  console.log("Post-run stats:");
  const postStats = await getRetentionJobStats();
  console.log(`  - Total events: ${postStats.totalEventsCount}`);
  console.log(`  - ID docs pending deletion: ${postStats.pendingIdDeletion}`);
  console.log(`  - Videos pending deletion: ${postStats.pendingVideoDeletion}`);
  console.log(`  - ID docs deleted: ${postStats.totalIdDeleted}`);
  console.log(`  - Videos deleted: ${postStats.totalVideoDeleted}`);

  console.log("");
  console.log("=".repeat(60));
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  process.exit(result.errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Retention job failed:", error);
  process.exit(1);
});
