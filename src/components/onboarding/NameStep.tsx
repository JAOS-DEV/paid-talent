"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@/components/ui";
import { updateProfileName } from "@/app/worker/actions";
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
} from "@/lib/profile/limits";

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
  const t = useTranslations("worker.profile");
  const common = useTranslations("common");
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (name.trim().length < DISPLAY_NAME_MIN_LENGTH) {
      setError(t("nameTooShort"));
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
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Input
          label={t("displayName")}
          placeholder={t("displayNamePlaceholder")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          error={error ?? undefined}
          autoFocus
        />
        <p className="text-charcoal-500 text-xs mt-2">
          {t("seenByRecruiters")}
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1"
        >
          {common("back")}
        </Button>
        <Button
          type="submit"
          loading={saving}
          disabled={name.trim().length < DISPLAY_NAME_MIN_LENGTH}
          className="flex-1"
        >
          {common("continue")}
        </Button>
      </div>
    </form>
  );
}
