"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui";
import { updateProfileBio } from "@/app/worker/actions";

interface BioStepProps {
  initialBio: string | null;
  onComplete: () => void;
  onBack: () => void;
}

export function BioStep({
  initialBio,
  onComplete,
  onBack,
}: BioStepProps): React.ReactElement {
  const [bio, setBio] = useState(initialBio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = bio.length;
  const minChars = 10;
  const maxChars = 500;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (bio.trim().length < minChars) {
      setError(`Bio must be at least ${minChars} characters`);
      return;
    }

    if (bio.length > maxChars) {
      setError(`Bio must be less than ${maxChars} characters`);
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const result = await updateProfileBio({ bio: bio.trim() });
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
        <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
          About You
        </label>
        <textarea
          className={`
            w-full px-4 py-2.5 bg-charcoal-800 border rounded-lg text-charcoal-100 
            placeholder:text-charcoal-500 focus:outline-none focus:ring-2 
            focus:ring-primary-500 focus:border-transparent min-h-[150px] resize-none
            ${error ? "border-error" : "border-charcoal-600"}
          `}
          placeholder="Tell recruiters about yourself, your strengths, and what makes you a great hire..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={maxChars}
          autoFocus
        />
        <div className="flex justify-between items-center mt-1.5">
          <p className="text-charcoal-500 text-xs">
            Minimum {minChars} characters
          </p>
          <p
            className={`text-xs ${
              charCount > maxChars
                ? "text-error"
                : charCount >= minChars
                  ? "text-charcoal-400"
                  : "text-charcoal-500"
            }`}
          >
            {charCount}/{maxChars}
          </p>
        </div>
        {error && <p className="text-error text-sm mt-2">{error}</p>}
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
          disabled={bio.trim().length < minChars}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
