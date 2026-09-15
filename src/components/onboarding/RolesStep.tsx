"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui";
import { updateProfileRoles } from "@/app/worker/actions";
import { JobRolesPicker } from "@/components/profile/JobRolesPicker";
import {
  splitStoredJobRoles,
  toPersistedJobRoles,
} from "@/lib/profile/job-roles";

interface RolesStepProps {
  initialRoles: string[];
  onComplete: () => void;
  onBack: () => void;
}

export function RolesStep({
  initialRoles,
  onComplete,
  onBack,
}: RolesStepProps): React.ReactElement {
  const initial = splitStoredJobRoles(initialRoles);
  const [predefined, setPredefined] = useState<string[]>(initial.predefined);
  const [otherSelected, setOtherSelected] = useState(initial.otherSelected);
  const [customRole, setCustomRole] = useState(initial.customRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistableRoles = toPersistedJobRoles(
    predefined,
    otherSelected,
    customRole
  );

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (otherSelected && !customRole.trim()) {
      setError("Enter a custom role when Other is selected");
      return;
    }

    if (persistableRoles.length === 0) {
      setError("Select at least one role");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const result = await updateProfileRoles({
        jobRoles: persistableRoles,
        customJobRole: otherSelected ? customRole.trim() : undefined,
      });
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
      <JobRolesPicker
        predefined={predefined}
        otherSelected={otherSelected}
        customRole={customRole}
        onPredefinedChange={(roles) => {
          setPredefined(roles);
          setError(null);
        }}
        onOtherSelectedChange={(selected) => {
          setOtherSelected(selected);
          setError(null);
        }}
        onCustomRoleChange={(value) => {
          setCustomRole(value);
          setError(null);
        }}
        error={error}
      />

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
          disabled={persistableRoles.length === 0 && !otherSelected}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
