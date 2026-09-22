"use client";

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Input,
  Textarea,
  Card,
  CardContent,
  Badge,
} from "@/components/ui";
import {
  BLURB_MAX_LENGTH,
  getRecruiterProfileCompleteness,
  type RecruiterProfileCompleteness,
} from "@/lib/recruiter-profile";
import { updateRecruiterProfile } from "@/lib/recruiter-profile/actions";
import type { RecruiterProfile } from "@/lib/db/schema";
import {
  VenueLogoPicker,
  type VenueLogoChange,
} from "@/components/recruiter/VenueLogoPicker";

interface RecruiterProfileFormProps {
  initialProfile: RecruiterProfile | null;
}

const REQUIRED_STEP_KEYS: Record<string, "venueStep" | "areaStep" | "blurbStep"> = {
  venue: "venueStep",
  area: "areaStep",
  blurb: "blurbStep",
};

const AREA_CHIPS = [
  "Sukhumvit",
  "Silom",
  "Walking Street",
  "Thonglor",
  "Khao San",
  "Pattaya",
  "Phuket",
] as const;

export function RecruiterProfileForm({
  initialProfile,
}: RecruiterProfileFormProps): React.ReactElement {
  const t = useTranslations("recruiter.profile");
  const common = useTranslations("common");
  const [organizationName, setOrganizationName] = useState(
    initialProfile?.organizationName || ""
  );
  const [area, setArea] = useState(initialProfile?.area || "");
  const [subArea, setSubArea] = useState(initialProfile?.subArea || "");
  const [blurb, setBlurb] = useState(initialProfile?.blurb || "");
  const [contactEmail, setContactEmail] = useState(
    initialProfile?.contactEmail || ""
  );
  const [contactPhone, setContactPhone] = useState(
    initialProfile?.contactPhone || ""
  );
  const [logo, setLogo] = useState<VenueLogoChange>({
    logoKey: initialProfile?.logoKey ?? null,
    logoUrl: initialProfile?.logoUrl ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [completeness, setCompleteness] = useState<RecruiterProfileCompleteness>(
    () => getRecruiterProfileCompleteness(initialProfile)
  );

  const missingRequired = useMemo(() => {
    return ["venue", "area", "blurb"]
      .filter((id) => !completeness.completedSteps.includes(id))
      .map((id) => {
        const key = REQUIRED_STEP_KEYS[id];
        return key ? t(key) : id;
      });
  }, [completeness.completedSteps, t]);

  const handleAreaChipClick = (chipArea: string): void => {
    setArea(chipArea);
  };

  const draftProfile = (nextLogo: VenueLogoChange): RecruiterProfile => {
    return {
      ...(initialProfile || ({} as RecruiterProfile)),
      organizationName: organizationName.trim(),
      area: area.trim(),
      subArea: subArea.trim() || null,
      blurb: blurb.trim(),
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      logoKey: nextLogo.logoKey,
      logoUrl: nextLogo.logoUrl,
    } as RecruiterProfile;
  };

  const handleLogoChange = (nextLogo: VenueLogoChange): void => {
    setLogo(nextLogo);
    setCompleteness(getRecruiterProfileCompleteness(draftProfile(nextLogo)));
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const result = await updateRecruiterProfile({
      organizationName,
      area,
      subArea: subArea || undefined,
      blurb,
      contactEmail: contactEmail || "",
      contactPhone: contactPhone || undefined,
    });

    setSaving(false);

    if (!result.success) {
      setError(result.error || t("saveFailed"));
      return;
    }

    setCompleteness(getRecruiterProfileCompleteness(draftProfile(logo)));
    setSuccess(t("saved"));
  };

  const blurbRemaining = BLURB_MAX_LENGTH - blurb.length;
  const blurbCounterColor =
    blurbRemaining <= 20
      ? "text-warning"
      : blurbRemaining <= 50
        ? "text-yellow-400"
        : "text-charcoal-400";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card padding="lg">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <VenueLogoPicker logoUrl={logo.logoUrl} onChange={handleLogoChange} />
              <div className="pt-1">
                <h2 className="text-xl font-semibold text-charcoal-100">
                  {t("title")}
                </h2>
                <p className="text-sm text-charcoal-400 mt-1">{t("subtitle")}</p>
                <p className="text-xs text-charcoal-500 mt-2">{t("logoHint")}</p>
              </div>
            </div>
            {completeness.isComplete ? (
              <Badge variant="success" className="flex-shrink-0">
                {common("complete")}
              </Badge>
            ) : (
              <Badge variant="warning" className="flex-shrink-0">
                {common("incomplete")}
              </Badge>
            )}
          </div>

          {!completeness.isComplete && missingRequired.length > 0 && (
            <div
              className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm"
              role="status"
            >
              <p className="text-charcoal-200">
                <span className="font-medium">{common("missing")}:</span>{" "}
                <span className="text-charcoal-400">
                  {missingRequired.join(", ")}
                </span>
              </p>
            </div>
          )}

          <CardContent className="space-y-4 !p-0">
            <Input
              label={t("venueName")}
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              maxLength={100}
              required
              autoComplete="organization"
              placeholder={t("venuePlaceholder")}
            />

            <div className="space-y-2">
              <Input
                label={t("area")}
                value={area}
                onChange={(e) => setArea(e.target.value)}
                maxLength={100}
                required
                placeholder={t("areaPlaceholder")}
              />
              <div className="flex flex-wrap gap-2">
                {AREA_CHIPS.map((chipArea) => (
                  <button
                    key={chipArea}
                    type="button"
                    onClick={() => handleAreaChipClick(chipArea)}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors min-h-[36px] ${
                      area === chipArea
                        ? "bg-primary-600 text-white"
                        : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
                    }`}
                  >
                    {chipArea}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label={t("subArea")}
              value={subArea}
              onChange={(e) => setSubArea(e.target.value)}
              maxLength={100}
              helperText={t("subAreaHelp")}
              placeholder={t("subAreaPlaceholder")}
            />

            <div>
              <Textarea
                label={t("about")}
                value={blurb}
                onChange={(e) =>
                  setBlurb(e.target.value.slice(0, BLURB_MAX_LENGTH))
                }
                maxLength={BLURB_MAX_LENGTH}
                required
                aria-describedby="blurb-counter"
                placeholder={t("aboutPlaceholder")}
              />
              <p id="blurb-counter" className={`mt-1.5 text-right text-sm ${blurbCounterColor}`}>
                {blurb.length}/{BLURB_MAX_LENGTH}
              </p>
            </div>

            <Input
              label={t("contactEmail")}
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              autoComplete="email"
              placeholder="venue@example.com"
            />

            <Input
              label={t("contactPhone")}
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              maxLength={20}
              autoComplete="tel"
              placeholder={t("phonePlaceholder")}
            />

            {error && (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-green-400" role="status">
                {success}
              </p>
            )}

            <Button type="submit" fullWidth loading={saving}>
              {t("save")}
            </Button>
          </CardContent>
        </div>
      </Card>
    </form>
  );
}
