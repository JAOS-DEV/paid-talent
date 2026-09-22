"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@/components/ui";
import { updateProfileContact, publishProfile } from "@/app/worker/actions";
import {
  LINE_ID_MAX_LENGTH,
  PHONE_NUMBER_MAX_LENGTH,
  WHATSAPP_MAX_LENGTH,
} from "@/lib/profile/limits";

interface ContactStepProps {
  initialLineId: string | null;
  initialWhatsApp: string | null;
  initialPhone: string | null;
  onComplete: () => void;
  onBack: () => void;
}

export function ContactStep({
  initialLineId,
  initialWhatsApp,
  initialPhone,
  onComplete,
  onBack,
}: ContactStepProps): React.ReactElement {
  const profile = useTranslations("worker.profile");
  const onboarding = useTranslations("worker.onboarding");
  const common = useTranslations("common");
  const [lineId, setLineId] = useState(initialLineId ?? "");
  const [whatsApp, setWhatsApp] = useState(initialWhatsApp ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const contactResult = await updateProfileContact({
        lineId: lineId.trim() || undefined,
        whatsappNumber: whatsApp.trim() || undefined,
        phoneNumber: phone.trim() || undefined,
      });
      if (!contactResult.success) {
        throw new Error(contactResult.error);
      }

      const publishResult = await publishProfile();
      if (!publishResult.success) {
        throw new Error(publishResult.error);
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip(): Promise<void> {
    setSaving(true);
    try {
      const publishResult = await publishProfile();
      if (!publishResult.success) {
        throw new Error(publishResult.error);
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : onboarding("publishFailed"));
      setSaving(false);
    }
  }

  const hasAnyContact = lineId.trim() || whatsApp.trim() || phone.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 mb-4">
        <p className="text-charcoal-300 text-sm">
          {onboarding("contactIntro")}
        </p>
      </div>

      <div className="space-y-4">
        <Input
          label={profile("lineId")}
          placeholder={profile("linePlaceholder")}
          value={lineId}
          maxLength={LINE_ID_MAX_LENGTH}
          onChange={(e) => setLineId(e.target.value)}
        />

        <Input
          label={onboarding("whatsappNumber")}
          type="tel"
          placeholder={onboarding("phoneExample")}
          value={whatsApp}
          maxLength={WHATSAPP_MAX_LENGTH}
          onChange={(e) => setWhatsApp(e.target.value)}
        />

        <Input
          label={profile("phone")}
          type="tel"
          placeholder={onboarding("phoneExample")}
          value={phone}
          maxLength={PHONE_NUMBER_MAX_LENGTH}
          onChange={(e) => setPhone(e.target.value)}
        />

        {error && <p className="text-error text-sm">{error}</p>}
      </div>

      <div className="flex flex-col gap-3 pt-4">
        <Button type="submit" loading={saving} fullWidth>
          {hasAnyContact ? onboarding("saveAndFinish") : onboarding("skipAndFinish")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={saving}
          fullWidth
        >
          {common("back")}
        </Button>
        {hasAnyContact && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="text-charcoal-500 text-sm hover:text-charcoal-300 transition-colors"
          >
            {onboarding("skipContacts")}
          </button>
        )}
      </div>
    </form>
  );
}
