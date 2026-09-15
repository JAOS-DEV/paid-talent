"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui";
import { updateProfileBio } from "@/app/worker/actions";
import { CharacterCount } from "@/components/profile/CharacterCount";
import { BIO_MAX_LENGTH, BIO_MIN_LENGTH } from "@/lib/profile/limits";

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

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (bio.trim().length < BIO_MIN_LENGTH) {
      setError(`Bio must be at least ${BIO_MIN_LENGTH} characters`);
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
          onChange={(e) => {
            setBio(e.target.value);
            setError(null);
          }}
          maxLength={BIO_MAX_LENGTH}
          autoFocus
        />
        <div className="flex justify-between items-center mt-1.5">
          <p className="text-charcoal-500 text-xs">
            Minimum {BIO_MIN_LENGTH} characters
          </p>
          <CharacterCount
            current={bio.length}
            max={BIO_MAX_LENGTH}
            min={BIO_MIN_LENGTH}
          />
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
          disabled={bio.trim().length < BIO_MIN_LENGTH}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
