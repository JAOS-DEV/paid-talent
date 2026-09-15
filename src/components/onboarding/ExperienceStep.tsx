"use client";

import React, { useState } from "react";
import { Button, Input } from "@/components/ui";
import { updateProfileExperience } from "@/app/worker/actions";
import { CharacterCount } from "@/components/profile/CharacterCount";
import {
  EXPERIENCE_DESCRIPTION_MAX_LENGTH,
  EXPERIENCE_YEARS_MAX,
  EXPERIENCE_YEARS_MIN,
} from "@/lib/profile/limits";

interface ExperienceStepProps {
  initialExperience: string | null;
  initialYears: number | null;
  onComplete: () => void;
  onBack: () => void;
}

export function ExperienceStep({
  initialExperience,
  initialYears,
  onComplete,
  onBack,
}: ExperienceStepProps): React.ReactElement {
  const [experience, setExperience] = useState(initialExperience ?? "");
  const [years, setYears] = useState(initialYears?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (!experience.trim() && !years) {
      setError("Please provide your experience or years");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const result = await updateProfileExperience({
        experience: experience.trim() || undefined,
        experienceYears: years ? parseInt(years, 10) : undefined,
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
      <div className="space-y-4">
        <Input
          label="Years of Experience"
          type="number"
          min={EXPERIENCE_YEARS_MIN}
          max={EXPERIENCE_YEARS_MAX}
          placeholder="e.g., 3"
          value={years}
          onChange={(e) => {
            setYears(e.target.value);
            setError(null);
          }}
        />

        <div>
          <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
            Experience Description
          </label>
          <textarea
            className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 placeholder:text-charcoal-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[100px]"
            placeholder="Describe your work history briefly..."
            value={experience}
            maxLength={EXPERIENCE_DESCRIPTION_MAX_LENGTH}
            onChange={(e) => {
              setExperience(e.target.value);
              setError(null);
            }}
          />
          <div className="flex justify-between items-center mt-1.5">
            <p className="text-charcoal-500 text-xs">
              Mention where you&apos;ve worked and what you did
            </p>
            <CharacterCount
              current={experience.length}
              max={EXPERIENCE_DESCRIPTION_MAX_LENGTH}
            />
          </div>
        </div>

        {error && <p className="text-error text-sm">{error}</p>}
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
          disabled={!experience.trim() && !years}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
