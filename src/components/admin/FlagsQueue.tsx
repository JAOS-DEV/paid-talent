"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { AdminStatusPill } from "@/components/admin/admin-display";
import { labelForToken } from "@/lib/admin/token-labels";

export interface AdminFlagRow {
  id: string;
  targetType: string;
  status: string;
  categories: string[];
  matchedTerms: string[];
  excerpt: string | null;
  conversationId: string | null;
  contactRequestId: string | null;
  authorUserId: string | null;
  createdAt: string;
}

interface FlagsQueueProps {
  initialFlags: AdminFlagRow[];
}

export function FlagsQueue({
  initialFlags,
}: FlagsQueueProps): React.ReactElement {
  const [flags, setFlags] = useState(initialFlags);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = async (
    flagId: string,
    status: "dismissed" | "actioned"
  ): Promise<void> => {
    setBusyId(flagId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/flags/${flagId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to review flag");
        return;
      }
      setFlags((prev) =>
        prev.map((f) => (f.id === flagId ? { ...f, status } : f))
      );
    } catch {
      setError("Failed to review flag");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-error">{error}</p> : null}
      {flags.length === 0 ? (
        <p className="text-sm text-charcoal-300">No open flags.</p>
      ) : (
        flags.map((flag) => (
          <article
            key={flag.id}
            className="rounded-xl border border-charcoal-800 bg-charcoal-900 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-charcoal-100">
                  {flag.categories.length > 0
                    ? flag.categories.map((category) => labelForToken(category)).join(", ")
                    : labelForToken(flag.targetType)}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-charcoal-300">
                  <span>{new Date(flag.createdAt).toLocaleString()}</span>
                  <AdminStatusPill status={flag.status} />
                </p>
              </div>
              {flag.conversationId ? (
                <Link
                  href={`/admin/conversations/${flag.conversationId}`}
                  className="text-sm text-primary-300"
                  prefetch={false}
                >
                  View conversation
                </Link>
              ) : null}
            </div>
            {flag.matchedTerms.length > 0 ? (
              <p className="text-sm text-charcoal-400">
                Matched: {flag.matchedTerms.join(", ")}
              </p>
            ) : null}
            {flag.excerpt ? (
              <p className="text-sm text-charcoal-300 whitespace-pre-wrap">
                {flag.excerpt}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={busyId === flag.id}
                onClick={() => void review(flag.id, "actioned")}
              >
                Actioned
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busyId === flag.id}
                onClick={() => void review(flag.id, "dismissed")}
              >
                Dismiss
              </Button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
