"use client";

import React, { useCallback, useState } from "react";
import { Button, Card, CardContent, Badge, Input } from "@/components/ui";
import {
  buildVerificationDecisionBody,
  type VerificationDocType,
} from "@/lib/admin/review-actions";

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
  canApprove: boolean;
}

const DOC_TYPE_OPTIONS: { value: VerificationDocType; label: string }[] = [
  { value: "passport", label: "Passport" },
  { value: "thai_id", label: "Thai ID" },
  { value: "drivers_license", label: "Driver's licence" },
  { value: "other", label: "Other" },
];

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

interface VerificationCardProps {
  worker: PendingWorker;
  onResolved: (id: string) => void;
}

function VerificationCard({
  worker,
  onResolved,
}: VerificationCardProps): React.ReactElement {
  const [docType, setDocType] = useState<VerificationDocType>("thai_id");
  const [last4, setLast4] = useState("");
  const [issuingCountry, setIssuingCountry] = useState("TH");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const missing = missingMaterials(worker);

  const submit = useCallback(
    async (action: "approve" | "reject") => {
      const body = buildVerificationDecisionBody({
        action,
        docType,
        last4,
        issuingCountry,
        notes,
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
        const response = await fetch(`/api/admin/workers/${worker.id}/verify`, {
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
    [worker, docType, last4, issuingCountry, notes, onResolved]
  );

  return (
    <Card padding="lg" className="w-full">
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-charcoal-100">
              {worker.displayName || "Unnamed worker"}
            </h2>
            <p className="text-sm text-charcoal-400">{worker.email || "No email"}</p>
            <p className="text-sm text-charcoal-500 mt-1">
              {[worker.location, worker.area].filter(Boolean).join(" · ") ||
                "Location not set"}
            </p>
          </div>
          <Badge variant="warning">{worker.verificationStatus}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-charcoal-500">Submitted</p>
            <p className="text-charcoal-200">
              {formatDate(worker.idDocumentSubmittedAt || worker.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-charcoal-500">Challenge code</p>
            <p className="text-2xl font-mono font-bold tracking-widest text-primary-300">
              {worker.challengeCodeDisplay || worker.challengeCode || "—"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-charcoal-300">ID document</h3>
            {worker.idDocumentUrl ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={worker.idDocumentUrl}
                  alt="ID document"
                  className="max-h-72 w-full object-contain rounded-lg border border-charcoal-700 bg-charcoal-900"
                />
                <a
                  href={worker.idDocumentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-primary-400 hover:underline"
                >
                  Open ID document
                </a>
              </div>
            ) : (
              <p className="text-sm text-red-400">ID document missing</p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-charcoal-300">
              Liveness video
            </h3>
            {worker.livenessVideoUrl ? (
              <video
                src={worker.livenessVideoUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full max-h-72 rounded-lg border border-charcoal-700 bg-charcoal-900"
              >
                Your browser does not support video playback.
              </video>
            ) : (
              <p className="text-sm text-red-400">Liveness video missing</p>
            )}
          </div>
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
                setDocType(e.target.value as VerificationDocType)
              }
              disabled={!!submitting || !!success}
              className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100"
            >
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
          />
          <Input
            label="Admin notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!!submitting || !!success}
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
              variant="outline"
              onClick={() => void submit("reject")}
              disabled={!!submitting}
              loading={submitting === "reject"}
              className="border-red-500/40 text-red-300 hover:bg-red-500/10"
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
}: {
  initialWorkers: PendingWorker[];
}): React.ReactElement {
  const [workers, setWorkers] = useState<PendingWorker[]>(initialWorkers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/workers/pending");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load pending verifications");
        setWorkers([]);
        return;
      }
      setWorkers(data.workers || []);
      setBanner(null);
    } catch {
      setError("Failed to load pending verifications");
    } finally {
      setLoading(false);
    }
  }, []);

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
        <p className="text-charcoal-400">
          No identity verifications are waiting for review.
        </p>
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
        <p className="text-sm text-charcoal-500">{workers.length} pending</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {workers.map((worker) => (
        <VerificationCard
          key={worker.id}
          worker={worker}
          onResolved={handleResolved}
        />
      ))}
    </div>
  );
}
