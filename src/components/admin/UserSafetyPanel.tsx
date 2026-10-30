"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { AdminReasonAlertDialog } from "@/components/admin/AdminReasonAlertDialog";

interface ReportSummary {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
}

interface UserSafetyPanelProps {
  userId: string;
  isRecruiter: boolean;
  messagingPaused: boolean;
  messagingPausedReason: string | null;
  blocksCount: number;
  reportsAgainst: ReportSummary[];
  reportsBy: ReportSummary[];
}

export function UserSafetyPanel({
  userId,
  isRecruiter,
  messagingPaused,
  messagingPausedReason,
  blocksCount,
  reportsAgainst,
  reportsBy,
}: UserSafetyPanelProps): React.ReactElement {
  const [paused, setPaused] = useState(messagingPaused);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePause = async (reason: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/recruiters/${userId}/messaging-pause`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused: !paused, reason }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to update pause");
        return;
      }
      const data = await res.json();
      setPaused(data.isPaused === true);
      setDialogOpen(false);
    } catch {
      setError("Failed to update pause");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Safety</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-charcoal-300">
        <p>Blocks involving this user: {blocksCount}</p>
        {isRecruiter ? (
          <div className="space-y-2">
            <p>
              Messaging:{" "}
              {paused
                ? `Paused${messagingPausedReason ? ` (${messagingPausedReason})` : ""}`
                : "Active"}
            </p>
            <Button
              type="button"
              variant={paused ? "outline" : "destructive"}
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              {paused ? "Unpause messaging" : "Pause messaging"}
            </Button>
          </div>
        ) : null}

        <div>
          <p className="font-medium text-charcoal-100 mb-2">
            Reports against ({reportsAgainst.length})
          </p>
          {reportsAgainst.length === 0 ? (
            <p className="text-charcoal-300">None</p>
          ) : (
            <ul className="space-y-1">
              {reportsAgainst.map((r) => (
                <li key={r.id}>
                  <Link
                    href="/admin/reports"
                    className="text-primary-300"
                    prefetch={false}
                  >
                    {r.reason.replaceAll("_", " ")} · {r.status}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="font-medium text-charcoal-100 mb-2">
            Reports by ({reportsBy.length})
          </p>
          {reportsBy.length === 0 ? (
            <p className="text-charcoal-300">None</p>
          ) : (
            <ul className="space-y-1">
              {reportsBy.map((r) => (
                <li key={r.id}>
                  {r.reason.replaceAll("_", " ")} · {r.status}
                </li>
              ))}
            </ul>
          )}
        </div>

        <AdminReasonAlertDialog
          open={dialogOpen}
          title={paused ? "Unpause messaging" : "Pause messaging"}
          description="This is recorded in the admin audit log."
          confirmLabel={paused ? "Unpause" : "Pause"}
          destructive={!paused}
          minLength={5}
          busy={busy}
          error={error}
          onCancel={() => {
            setDialogOpen(false);
            setError(null);
          }}
          onConfirm={(reason) => void togglePause(reason)}
        />
      </CardContent>
    </Card>
  );
}
