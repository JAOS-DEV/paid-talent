"use client";

import React, { useCallback, useState } from "react";
import { Button, Card, CardContent, Badge, Input } from "@/components/ui";
import { buildPhotoRejectBody } from "@/lib/admin/review-actions";
import { formatModerationConfidencePercent } from "@/lib/admin/format-confidence";

export interface PendingPhoto {
  id: string;
  userId: string;
  workerProfileId: string;
  photoUrl: string | null;
  moderationReason: string | null;
  moderationConfidence: number | null;
  moderationCategories: string[] | null;
  createdAt: string;
  submissionKind?: "primary" | "gallery";
  worker: {
    displayName: string;
    email: string | null;
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

interface PhotoCardProps {
  photo: PendingPhoto;
  onResolved: (id: string) => void;
}

function PhotoCard({ photo, onResolved }: PhotoCardProps): React.ReactElement {
  const [reason, setReason] = useState("");
  const [confirmReject, setConfirmReject] = useState(false);
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(photo.photoUrl);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(Boolean(photo.photoUrl));

  const loadMedia = useCallback(async (): Promise<void> => {
    if (photoUrl) {
      setReviewOpen(true);
      return;
    }
    setMediaLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/photos/${photo.id}/media`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load photo");
        return;
      }
      setPhotoUrl(data.photoUrl ?? null);
      setReviewOpen(true);
    } catch {
      setError("Failed to load photo");
    } finally {
      setMediaLoading(false);
    }
  }, [photo.id, photoUrl]);

  const approve = useCallback(async () => {
    setSubmitting("approve");
    setError(null);
    try {
      const res = await fetch(`/api/admin/photos/${photo.id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Approve failed");
        setSubmitting(null);
        return;
      }
      setSuccess("Photo approved");
      onResolved(photo.id);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(null);
    }
  }, [photo.id, onResolved]);

  const reject = useCallback(async () => {
    setSubmitting("reject");
    setError(null);
    try {
      const res = await fetch(`/api/admin/photos/${photo.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPhotoRejectBody(reason)),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reject failed");
        setSubmitting(null);
        return;
      }
      setSuccess("Photo rejected");
      onResolved(photo.id);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(null);
    }
  }, [photo.id, reason, onResolved]);

  return (
    <div data-testid="pending-photo-card">
    <Card padding="lg" className="w-full">
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          {reviewOpen ? (
            photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`Profile photo for ${photo.worker.displayName}`}
              className="w-full sm:w-48 h-48 object-cover rounded-lg border border-charcoal-700 bg-charcoal-900"
            />
            ) : (
            <div className="w-full sm:w-48 h-48 rounded-lg border border-charcoal-700 bg-charcoal-900 flex items-center justify-center text-sm text-charcoal-500 px-3 text-center">
              Preview unavailable
            </div>
            )
          ) : (
            <div className="w-full sm:w-48 h-48 rounded-lg border border-charcoal-700 bg-charcoal-900 flex items-center justify-center px-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadMedia()}
                loading={mediaLoading}
                disabled={mediaLoading}
              >
                Review photo
              </Button>
            </div>
          )}
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-charcoal-100">
                  {photo.worker.displayName}
                </h2>
                <p className="text-sm text-charcoal-400">
                  {photo.worker.email || "No email"}
                </p>
              </div>
              <Badge variant="warning">pending</Badge>
            </div>
            <p className="text-sm text-charcoal-300" data-testid={`photo-submission-${photo.submissionKind ?? "primary"}`}>
              <span className="text-charcoal-500">Submission: </span>
              {photo.submissionKind === "gallery"
                ? "Gallery photo"
                : "Primary submission"}
            </p>
            <p className="text-sm text-charcoal-300">
              <span className="text-charcoal-500">Reason: </span>
              {photo.moderationReason || "—"}
            </p>
              <p className="text-sm text-charcoal-300">
              <span className="text-charcoal-500">Confidence: </span>
              {formatModerationConfidencePercent(photo.moderationConfidence)}
            </p>
            <p className="text-sm text-charcoal-300">
              <span className="text-charcoal-500">Categories: </span>
              {photo.moderationCategories?.length
                ? photo.moderationCategories.join(", ")
                : "—"}
            </p>
            {photo.moderationCategories?.includes("explicit_nudity") ? (
              <p className="text-sm text-yellow-300">
                Analyzer flagged explicit content. This is advisory only — approve
                or reject manually.
              </p>
            ) : null}
            <p className="text-sm text-charcoal-500">
              Uploaded {formatDate(photo.createdAt)}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
            {success}. Removed from queue.
          </div>
        )}

        {!success && (
          <div className="space-y-3">
            <Input
              label="Reject reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!!submitting}
            />

            {!confirmReject ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  onClick={() => void approve()}
                  disabled={!!submitting}
                  loading={submitting === "approve"}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmReject(true)}
                  disabled={!!submitting}
                  className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                >
                  Reject
                </Button>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5 space-y-3">
                <p className="text-sm text-red-300">
                  Confirm rejection of this photo? This cannot be undone from
                  the queue.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    onClick={() => void reject()}
                    disabled={!!submitting}
                    loading={submitting === "reject"}
                    className="bg-red-600 hover:bg-red-700 border-transparent"
                  >
                    Confirm reject
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmReject(false)}
                    disabled={!!submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

export function PhotoQueue({
  initialPhotos,
}: {
  initialPhotos: PendingPhoto[];
}): React.ReactElement {
  const [photos, setPhotos] = useState<PendingPhoto[]>(initialPhotos);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/photos/pending");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load pending photos");
        setPhotos([]);
        return;
      }
      setPhotos(data.photos || []);
      setBanner(null);
    } catch {
      setError("Failed to load pending photos");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleResolved = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setBanner("Decision saved.");
  }, []);

  if (loading) {
    return (
      <p className="text-charcoal-400" role="status">
        Loading pending photos…
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

  if (photos.length === 0) {
    return (
      <div className="space-y-2">
        {banner && <p className="text-green-400 text-sm">{banner}</p>}
        <p className="text-charcoal-400">No photos are waiting for review.</p>
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
        <p className="text-sm text-charcoal-500">{photos.length} pending</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} onResolved={handleResolved} />
      ))}
    </div>
  );
}
