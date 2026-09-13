"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui";
import { updateProfileLanguages } from "@/app/worker/actions";
import { LANGUAGE_OPTIONS } from "@/lib/profile";

interface LanguagesStepProps {
  initialLanguages: string[];
  onComplete: () => void;
  onBack: () => void;
}

export function LanguagesStep({
  initialLanguages,
  onComplete,
  onBack,
}: LanguagesStepProps): React.ReactElement {
  const [selectedLanguages, setSelectedLanguages] =
    useState<string[]>(initialLanguages);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleLanguage(language: string): void {
    setSelectedLanguages((prev) =>
      prev.includes(language)
        ? prev.filter((l) => l !== language)
        : [...prev, language]
    );
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (selectedLanguages.length === 0) {
      setError("Select at least one language");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const result = await updateProfileLanguages({
        languages: selectedLanguages,
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
      <div>
        <p className="text-charcoal-400 text-sm mb-4">
          Select all languages you can speak
        </p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((language) => (
            <button
              key={language}
              type="button"
              onClick={() => toggleLanguage(language)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-colors
                ${
                  selectedLanguages.includes(language)
                    ? "bg-primary-600 text-white"
                    : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
                }
              `}
            >
              {language}
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
          disabled={selectedLanguages.length === 0}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
