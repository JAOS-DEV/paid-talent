"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { AdminStatusPill } from "@/components/admin/admin-display";
import { labelForToken } from "@/lib/admin/token-labels";
import { AdminReasonAlertDialog } from "@/components/admin/AdminReasonAlertDialog";
import { ConfirmReasonDialog } from "@/components/admin/ConfirmReasonDialog";

export interface AdminReportRow {
  id: string;
  reason: string;
  status: string;
  details: string | null;
  reporterUserId: string | null;
  reportedUserId: string | null;
  reporterName: string | null;
  reportedName: string | null;
  contactRequestId: string | null;
  conversationId: string | null;
  createdAt: string;
  resolutionNote: string | null;
}

interface ReportsQueueProps {
  initialReports: AdminReportRow[];
}

export function ReportsQueue({
  initialReports,
}: ReportsQueueProps): React.ReactElement {
  const [reports, setReports] = useState(initialReports);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    reportId: string;
    status: "actioned" | "dismissed" | "reviewing";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pauseUserId, setPauseUserId] = useState<string | null>(null);

  const resolve = async (note: string): Promise<void> => {
    if (!dialog) return;
    setBusyId(dialog.reportId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${dialog.reportId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: dialog.status, note }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to update report");
        return;
      }
      setReports((prev) =>
        prev.map((r) =>
          r.id === dialog.reportId
            ? { ...r, status: dialog.status, resolutionNote: note }
            : r
        )
      );
      setDialog(null);
    } catch {
      setError("Failed to update report");
    } finally {
      setBusyId(null);
    }
  };

  const pauseMessaging = async (reason: string): Promise<void> => {
    if (!pauseUserId || reason.trim().length < 5) return;
    setBusyId(pauseUserId);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/recruiters/${pauseUserId}/messaging-pause`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused: true, reason: reason.trim() }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to pause messaging");
        return;
      }
      setPauseUserId(null);
    } catch {
      setError("Failed to pause messaging");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {reports.length === 0 ? (
        <p className="text-sm text-charcoal-500">No open reports.</p>
      ) : (
        reports.map((report) => (
          <article
            key={report.id}
            className="rounded-xl border border-charcoal-800 bg-charcoal-900 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-charcoal-100">
                  {labelForToken(report.reason)}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-charcoal-300">
                  <span>{new Date(report.createdAt).toLocaleString()}</span>
                  <AdminStatusPill status={report.status} />
                </p>
              </div>
              {report.conversationId ? (
                <Link
                  href={`/admin/conversations/${report.conversationId}`}
                  className="text-sm text-primary-300"
                  prefetch={false}
                >
                  View conversation
                </Link>
              ) : null}
            </div>
            <p className="text-sm text-charcoal-300">
              Reporter:{" "}
              {report.reporterUserId ? (
                <Link
                  href={`/admin/users/${report.reporterUserId}`}
                  className="text-primary-300"
                  prefetch={false}
                >
                  {report.reporterName || report.reporterUserId}
                </Link>
              ) : (
                "—"
              )}{" "}
              → Reported:{" "}
              {report.reportedUserId ? (
                <Link
                  href={`/admin/users/${report.reportedUserId}`}
                  className="text-primary-300"
                  prefetch={false}
                >
                  {report.reportedName || report.reportedUserId}
                </Link>
              ) : (
                "—"
              )}
            </p>
            {report.details ? (
              <p className="text-sm text-charcoal-400 whitespace-pre-wrap">
                {report.details}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busyId === report.id}
                onClick={() =>
                  setDialog({ reportId: report.id, status: "reviewing" })
                }
              >
                Mark reviewing
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={busyId === report.id}
                onClick={() =>
                  setDialog({ reportId: report.id, status: "actioned" })
                }
              >
                Actioned
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busyId === report.id}
                onClick={() =>
                  setDialog({ reportId: report.id, status: "dismissed" })
                }
              >
                Dismiss
              </Button>
              {report.reportedUserId ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setPauseUserId(report.reportedUserId)}
                >
                  Pause messaging
                </Button>
              ) : null}
            </div>
          </article>
        ))
      )}

      <ConfirmReasonDialog
        open={dialog != null}
        title="Resolve report"
        description="Add a short note for the audit log."
        confirmLabel="Save"
        busy={busyId != null}
        error={error}
        onCancel={() => {
          setDialog(null);
          setError(null);
        }}
        onConfirm={(note) => void resolve(note)}
      />
      <AdminReasonAlertDialog
        open={pauseUserId != null}
        title="Pause messaging"
        description="The recruiter cannot send messages until messaging is unpaused. The reason is stored on the audit row."
        confirmLabel="Pause"
        destructive
        minLength={5}
        busy={busyId != null && busyId === pauseUserId}
        error={pauseUserId ? error : null}
        onCancel={() => {
          setPauseUserId(null);
          setError(null);
        }}
        onConfirm={(reason) => void pauseMessaging(reason)}
      />
    </div>
  );
}
