"use client";

import React, { useState } from "react";
import { Button, Input } from "@/components/ui";
import { updateProfileName } from "@/app/worker/actions";

interface NameStepProps {
  initialName: string;
  onComplete: () => void;
  onBack: () => void;
}

export function NameStep({
  initialName,
  onComplete,
  onBack,
}: NameStepProps): React.ReactElement {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const result = await updateProfileName({ displayName: name.trim() });
      if (!result.success) {
        throw new Error(result.error);
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Input
          label="Display Name"
          placeholder="How you want to be called"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error ?? undefined}
          autoFocus
        />
        <p className="text-charcoal-500 text-xs mt-2">
          This is how recruiters will see you
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="submit"
          loading={saving}
          disabled={name.trim().length < 2}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
