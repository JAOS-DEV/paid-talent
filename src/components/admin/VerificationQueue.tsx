"use client";

import React, { useCallback, useState } from "react";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { AdminStatusPill } from "@/components/admin/admin-display";
import { AdminLivenessVideoPlayer } from "@/components/admin/AdminLivenessVideoPlayer";
import {
  buildVerificationDecisionBody,
  type VerificationDocType,
} from "@/lib/admin/review-actions";
import {
  USER_REJECTION_REASON_CODES,
  type UserRejectionReasonCode,
} from "@/lib/verification/rejection-reasons";

export interface PendingWorker {
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  location: string | null;
  area: string | null;
  verificationStatus: string;
  idDocumentSubmittedAt: string | null;
  createdAt: string;
  hasIdDocument: boolean;
  hasLivenessVideo: boolean;
  hasChallengeCode: boolean;
  challengeCode: string | null;
  challengeCodeDisplay: string | null;
  challengeIssuedAt: string | null;
  idDocumentUrl: string | null;
  livenessVideoUrl: string | null;
  livenessVideoContentType?: string | null;
  canApprove: boolean;
}

const DOC_TYPE_OPTIONS: { value: VerificationDocType; label: string }[] = [
  { value: "passport", label: "Passport" },
  { value: "thai_id", label: "Thai ID" },
  { value: "drivers_license", label: "Driver's licence" },
  { value: "other", label: "Other" },
];

const USER_REASON_LABELS: Record<UserRejectionReasonCode, string> = {
  document_unreadable: "Document unreadable",
  face_mismatch: "Face doesn't match",
  liveness_failed: "Liveness check failed",
  document_expired: "Document expired",
  other: "Other",
};

function missingMaterials(worker: PendingWorker): string[] {
  const missing: string[] = [];
  if (!worker.hasIdDocument) missing.push("ID document");
  if (!worker.hasLivenessVideo) missing.push("Liveness video");
  if (!worker.hasChallengeCode) missing.push("Challenge code");
  return missing;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

type VerificationSubjectType = "worker" | "recruiter";

interface VerificationCardProps {
  worker: PendingWorker;
  subjectType: VerificationSubjectType;
  onResolved: (id: string) => void;
}

function VerificationCard({
  worker,
  subjectType,
  onResolved,
}: VerificationCardProps): React.ReactElement {
  const apiBase =
    subjectType === "recruiter"
      ? "/api/admin/recruiters"
      : "/api/admin/workers";
  const [docType, setDocType] = useState<VerificationDocType | "">("");
  const [last4, setLast4] = useState("");
  const [issuingCountry, setIssuingCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [userReasonCode, setUserReasonCode] = useState<
    UserRejectionReasonCode | ""
  >("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | null>(
    worker.idDocumentUrl
  );
  const [livenessVideoUrl, setLivenessVideoUrl] = useState<string | null>(
    worker.livenessVideoUrl
  );
  const [livenessVideoContentType, setLivenessVideoContentType] = useState<
    string | null
  >(worker.livenessVideoContentType ?? null);

  const missing = missingMaterials(worker);

  const loadMedia = useCallback(async (): Promise<void> => {
    if (idDocumentUrl || livenessVideoUrl) {
      setReviewOpen(true);
      return;
    }
    setMediaLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/${worker.id}/media`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to load verification media");
        return;
      }
      setIdDocumentUrl(data.idDocumentUrl ?? null);
      setLivenessVideoUrl(data.livenessVideoUrl ?? null);
      setLivenessVideoContentType(data.livenessVideoContentType ?? null);
      setReviewOpen(true);
    } catch {
      setError("Failed to load verification media");
    } finally {
      setMediaLoading(false);
    }
  }, [apiBase, idDocumentUrl, livenessVideoUrl, worker.id]);

  const submit = useCallback(
    async (action: "approve" | "reject") => {
      if (action === "reject" && !userReasonCode) {
        setError("Choose the reason shown to the user.");
        return;
      }

      const body = buildVerificationDecisionBody({
        action,
        docType: docType || undefined,
        last4,
        issuingCountry,
        notes,
        userReasonCode: userReasonCode || undefined,
        canApprove: worker.canApprove,
      });

      if (!body) {
        setError("Cannot approve — required materials are missing.");
        return;
      }

      setSubmitting(action);
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch(`${apiBase}/${worker.id}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) {
          setError(
            data.error ||
              (Array.isArray(data.details)
                ? data.details.join(", ")
                : "Request failed")
          );
          setSubmitting(null);
          return;
        }

        setSuccess(action === "approve" ? "Approved" : "Rejected");
        onResolved(worker.id);
      } catch {
        setError("Something went wrong. Please try again.");
        setSubmitting(null);
      }
    },
    [
      apiBase,
      worker,
      docType,
      last4,
      issuingCountry,
      notes,
      userReasonCode,
      onResolved,
    ]
  );

  return (
    <Card padding="lg" className="w-full">
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-charcoal-100">
              {worker.displayName ||
                (subjectType === "recruiter"
                  ? "Unnamed venue"
                  : "Unnamed talent")}
            </h2>
            <p className="text-sm text-charcoal-400">{worker.email || "No email"}</p>
            <p className="text-sm text-charcoal-300 mt-1">
              {[worker.location, worker.area].filter(Boolean).join(" · ") ||
                "Location not set"}
            </p>
          </div>
          <AdminStatusPill status={worker.verificationStatus} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-charcoal-300">Submitted</p>
            <p className="text-charcoal-200">
              {formatDate(worker.idDocumentSubmittedAt || worker.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-charcoal-300">Challenge code</p>
            <p className="text-2xl font-mono font-bold tracking-widest text-primary-300">
              {worker.challengeCodeDisplay || worker.challengeCode || "—"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {!reviewOpen ? (
            <div className="lg:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadMedia()}
                loading={mediaLoading}
                disabled={mediaLoading}
              >
                Review documents
              </Button>
            </div>
          ) : (
            <>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-charcoal-300">ID document</h3>
            {idDocumentUrl ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={idDocumentUrl}
                  alt="ID document"
                  className="max-h-72 w-full object-contain rounded-lg border border-charcoal-700 bg-charcoal-900"
                />
                <a
                  href={idDocumentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-primary-400 hover:underline"
                >
                  Open ID document
                </a>
              </div>
            ) : worker.hasIdDocument ? (
              <p className="text-sm text-charcoal-400">ID preview unavailable.</p>
            ) : (
              <p className="text-sm text-red-400">ID document missing</p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-charcoal-300">
              Liveness video
            </h3>
            {livenessVideoUrl ? (
              <AdminLivenessVideoPlayer
                url={livenessVideoUrl}
                contentType={livenessVideoContentType}
              />
            ) : worker.hasLivenessVideo ? (
              <p className="text-sm text-charcoal-400">
                Liveness preview unavailable.
              </p>
            ) : (
              <p className="text-sm text-red-400">Liveness video missing</p>
            )}
          </div>
            </>
          )}
        </div>

        {!worker.canApprove && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
            Approve unavailable. Missing: {missing.join(", ") || "required materials"}.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`docType-${worker.id}`}
              className="block text-sm font-medium text-charcoal-200 mb-1.5"
            >
              Document type
            </label>
            <select
              id={`docType-${worker.id}`}
              value={docType}
              onChange={(e) =>
                setDocType(e.target.value as VerificationDocType | "")
              }
              disabled={!!submitting || !!success}
              className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100"
            >
              <option value="">Select document type</option>
              {DOC_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Last 4 (optional)"
            value={last4}
            onChange={(e) => setLast4(e.target.value.slice(0, 4))}
            maxLength={4}
            disabled={!!submitting || !!success}
          />
          <Input
            label="Issuing country (optional)"
            value={issuingCountry}
            onChange={(e) => setIssuingCountry(e.target.value.slice(0, 3))}
            maxLength={3}
            disabled={!!submitting || !!success}
            placeholder="e.g. TH"
          />
          <div className="space-y-1.5">
            <label
              htmlFor={`userReason-${worker.id}`}
              className="block text-sm font-medium text-charcoal-200"
            >
              Reason shown to the user
            </label>
            <select
              id={`userReason-${worker.id}`}
              value={userReasonCode}
              required
              onChange={(e) =>
                setUserReasonCode(
                  e.target.value as UserRejectionReasonCode | ""
                )
              }
              disabled={!!submitting || !!success}
              className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100"
            >
              <option value="">Select a reason</option>
              {USER_REJECTION_REASON_CODES.map((code) => (
                <option key={code} value={code}>
                  {USER_REASON_LABELS[code]}
                </option>
              ))}
            </select>
            <p className="text-xs text-charcoal-300">
              Talent and venues see this reason. They do not see admin notes.
            </p>
          </div>
          <Input
            label="Admin notes (internal only)"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            maxLength={500}
            disabled={!!submitting || !!success}
            helperText={`${notes.length}/500`}
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
            {success}. Removed from pending queue.
          </div>
        )}

        {!success && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              onClick={() => void submit("approve")}
              disabled={!worker.canApprove || !!submitting}
              loading={submitting === "approve"}
            >
              Approve
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void submit("reject")}
              disabled={!!submitting || !userReasonCode}
              loading={submitting === "reject"}
            >
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function VerificationQueue({
  initialWorkers,
  subjectType = "worker",
}: {
  initialWorkers: PendingWorker[];
  subjectType?: VerificationSubjectType;
}): React.ReactElement {
  const [workers, setWorkers] = useState<PendingWorker[]>(initialWorkers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const pendingPath =
    subjectType === "recruiter"
      ? "/api/admin/recruiters/pending"
      : "/api/admin/workers/pending";
  const emptyLabel =
    subjectType === "recruiter"
      ? "No recruiter identity verifications are waiting for review."
      : "No identity verifications are waiting for review.";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(pendingPath);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load pending verifications");
        setWorkers([]);
        return;
      }
      setWorkers(data.workers || data.recruiters || []);
      setBanner(null);
    } catch {
      setError("Failed to load pending verifications");
    } finally {
      setLoading(false);
    }
  }, [pendingPath]);

  const handleResolved = useCallback((id: string) => {
    setWorkers((prev) => prev.filter((w) => w.id !== id));
    setBanner("Decision saved.");
  }, []);

  if (loading) {
    return (
      <p className="text-charcoal-400" role="status">
        Loading pending verifications…
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-red-400">{error}</p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <div className="space-y-2">
        {banner && <p className="text-green-400 text-sm">{banner}</p>}
        <p className="text-charcoal-400">{emptyLabel}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {banner && <p className="text-green-400 text-sm">{banner}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-charcoal-300">{workers.length} pending</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {workers.map((worker) => (
        <VerificationCard
          key={worker.id}
          worker={worker}
          subjectType={subjectType}
          onResolved={handleResolved}
        />
      ))}
    </div>
  );
}
