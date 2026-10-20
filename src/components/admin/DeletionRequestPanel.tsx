"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

interface DeletionRequestPanelProps {
  userId: string;
  deletionRequestedAt: string;
}

export function DeletionRequestPanel({
  userId,
  deletionRequestedAt,
}: DeletionRequestPanelProps): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestedOn = new Date(deletionRequestedAt).toLocaleString();

  const cancel = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/cancel-deletion`, {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not cancel deletion.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not cancel deletion.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Account deletion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-charcoal-300">
          Deletion requested on {requestedOn}
        </p>
        <p className="text-sm text-charcoal-400">
          The account is purged about 30 days after this request unless you cancel it.
        </p>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            void cancel();
          }}
        >
          {busy ? "Cancelling…" : "Cancel deletion"}
        </Button>
      </CardContent>
    </Card>
  );
}
