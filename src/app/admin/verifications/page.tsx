import React from "react";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import {
  listPendingRecruitersForAdmin,
  listPendingWorkersForAdmin,
} from "@/lib/admin/pending-data";
import { VerificationQueue } from "@/components/admin/VerificationQueue";
import type { PendingWorker } from "@/components/admin/VerificationQueue";

function serializePending(
  items: Array<{
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
    livenessVideoContentType: string | null;
    canApprove: boolean;
  }>
): PendingWorker[] {
  return items.map((item) => ({
    ...item,
    idDocumentSubmittedAt: item.idDocumentSubmittedAt
      ? item.idDocumentSubmittedAt.toISOString()
      : null,
    createdAt: item.createdAt.toISOString(),
    challengeIssuedAt: item.challengeIssuedAt
      ? item.challengeIssuedAt.toISOString()
      : null,
  }));
}

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}): Promise<React.ReactElement> {
  const { email } = await requireAdminPage("/admin/verifications");
  const params = await searchParams;
  const tab = params.tab === "recruiters" ? "recruiters" : "workers";

  const [{ workers, count: workerCount }, { recruiters, count: recruiterCount }] =
    await Promise.all([
      listPendingWorkersForAdmin({
        adminEmail: email,
        includeSignedMedia: false,
      }),
      listPendingRecruitersForAdmin({
        adminEmail: email,
        includeSignedMedia: false,
      }),
    ]);

  const pending =
    tab === "recruiters"
      ? serializePending(recruiters)
      : serializePending(workers);

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

      <div className="flex flex-wrap gap-2 border-b border-charcoal-800 pb-3">
        <Link
          href="/admin/verifications"
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === "workers"
              ? "bg-charcoal-800 text-charcoal-100"
              : "text-charcoal-400 hover:text-charcoal-200"
          }`}
        >
          Workers ({workerCount})
        </Link>
        <Link
          href="/admin/verifications?tab=recruiters"
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === "recruiters"
              ? "bg-charcoal-800 text-charcoal-100"
              : "text-charcoal-400 hover:text-charcoal-200"
          }`}
        >
          Recruiters ({recruiterCount})
        </Link>
      </div>

      <VerificationQueue
        key={tab}
        initialWorkers={pending}
        subjectType={tab === "recruiters" ? "recruiter" : "worker"}
      />
    </div>
  );
}
