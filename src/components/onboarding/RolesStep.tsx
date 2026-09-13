"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui";
import { updateProfileRoles } from "@/app/worker/actions";
import { JOB_ROLE_OPTIONS } from "@/lib/profile";

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
  const [selectedRoles, setSelectedRoles] = useState<string[]>(initialRoles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(role: string): void {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (selectedRoles.length === 0) {
      setError("Select at least one role");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const result = await updateProfileRoles({ jobRoles: selectedRoles });
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
        <p className="text-charcoal-400 text-sm mb-4">
          Select all the roles you can fill
        </p>
        <div className="flex flex-wrap gap-2">
          {JOB_ROLE_OPTIONS.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => toggleRole(role)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-colors
                ${
                  selectedRoles.includes(role)
                    ? "bg-primary-600 text-white"
                    : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
                }
              `}
            >
              {role}
            </button>
          ))}
        </div>
        {error && <p className="text-error text-sm mt-3">{error}</p>}
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
          disabled={selectedRoles.length === 0}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
