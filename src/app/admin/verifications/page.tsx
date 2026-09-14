import React from "react";
import { requireAdminPage } from "@/lib/admin/guard";
import { listPendingWorkersForAdmin } from "@/lib/admin/pending-data";
import { VerificationQueue } from "@/components/admin/VerificationQueue";
import type { PendingWorker } from "@/components/admin/VerificationQueue";

function serializeWorkers(
  workers: Awaited<ReturnType<typeof listPendingWorkersForAdmin>>["workers"]
): PendingWorker[] {
  return workers.map((worker) => ({
    ...worker,
    idDocumentSubmittedAt: worker.idDocumentSubmittedAt
      ? worker.idDocumentSubmittedAt.toISOString()
      : null,
    createdAt: worker.createdAt.toISOString(),
    challengeIssuedAt: worker.challengeIssuedAt
      ? worker.challengeIssuedAt.toISOString()
      : null,
  }));
}

export default async function AdminVerificationsPage(): Promise<React.ReactElement> {
  const { email } = await requireAdminPage("/admin/verifications");
  const { workers } = await listPendingWorkersForAdmin({
    adminEmail: email,
    includeSignedMedia: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">
          Identity verification
        </h1>
        <p className="text-charcoal-400 mt-1">
          Compare the challenge code to the liveness video and ID document.
          Open a review to load short-lived signed media.
        </p>
      </div>
      <VerificationQueue initialWorkers={serializeWorkers(workers)} />
    </div>
  );
}
