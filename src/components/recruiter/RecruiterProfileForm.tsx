"use client";

import React, { useMemo, useState } from "react";
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

interface RecruiterProfileFormProps {
  initialProfile: RecruiterProfile | null;
}

const REQUIRED_STEP_LABELS: Record<string, string> = {
  venue: "Venue / organisation name",
  area: "Area",
  blurb: "About your venue",
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [completeness, setCompleteness] = useState<RecruiterProfileCompleteness>(
    () => getRecruiterProfileCompleteness(initialProfile)
  );

  const missingRequired = useMemo(() => {
    return ["venue", "area", "blurb"]
      .filter((id) => !completeness.completedSteps.includes(id))
      .map((id) => REQUIRED_STEP_LABELS[id] || id);
  }, [completeness.completedSteps]);

  const handleAreaChipClick = (chipArea: string): void => {
    setArea(chipArea);
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
      setError(result.error || "Failed to save profile");
      return;
    }

    const nextProfile = {
      ...(initialProfile || ({} as RecruiterProfile)),
      organizationName: organizationName.trim(),
      area: area.trim(),
      subArea: subArea.trim() || null,
      blurb: blurb.trim(),
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
    } as RecruiterProfile;

    setCompleteness(getRecruiterProfileCompleteness(nextProfile));
    setSuccess("Venue profile saved");
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
              <div className="relative flex-shrink-0">
                <div
                  className="w-20 h-20 rounded-full bg-charcoal-800 border-2 border-dashed border-charcoal-600 flex items-center justify-center cursor-not-allowed"
                  aria-label="Logo placeholder"
                >
                  <svg
                    className="w-8 h-8 text-charcoal-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-charcoal-500 whitespace-nowrap">
                  Add logo
                </p>
              </div>
              <div className="pt-1">
                <h2 className="text-xl font-semibold text-charcoal-100">
                  Venue profile
                </h2>
                <p className="text-sm text-charcoal-400 mt-1">
                  This is what workers see when you express interest.
                </p>
                <p className="text-xs text-charcoal-500 mt-2">
                  Logo upload coming soon. Optional. Shows on your openings.
                </p>
              </div>
            </div>
            {completeness.isComplete ? (
              <Badge variant="success" className="flex-shrink-0">
                Complete
              </Badge>
            ) : (
              <Badge variant="warning" className="flex-shrink-0">
                Incomplete
              </Badge>
            )}
          </div>

          {!completeness.isComplete && missingRequired.length > 0 && (
            <div
              className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm"
              role="status"
            >
              <p className="text-charcoal-200">
                <span className="font-medium">Missing:</span>{" "}
                <span className="text-charcoal-400">
                  {missingRequired.join(", ")}
                </span>
              </p>
            </div>
          )}

          <CardContent className="space-y-4 !p-0">
            <Input
              label="Venue / organisation name *"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              maxLength={100}
              required
              autoComplete="organization"
              placeholder="e.g. Club Insomnia"
            />

            <div className="space-y-2">
              <Input
                label="Area *"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                maxLength={100}
                required
                placeholder="e.g. Sukhumvit"
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
              label="Sub-area"
              value={subArea}
              onChange={(e) => setSubArea(e.target.value)}
              maxLength={100}
              helperText="Optional district or soi"
              placeholder="e.g. Soi 11"
            />

            <div>
              <Textarea
                label="About your venue *"
                value={blurb}
                onChange={(e) =>
                  setBlurb(e.target.value.slice(0, BLURB_MAX_LENGTH))
                }
                maxLength={BLURB_MAX_LENGTH}
                required
                aria-describedby="blurb-counter"
                placeholder="What workers should know about your venue"
              />
              <p id="blurb-counter" className={`mt-1.5 text-right text-sm ${blurbCounterColor}`}>
                {blurb.length}/{BLURB_MAX_LENGTH}
              </p>
            </div>

            <Input
              label="Contact email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              autoComplete="email"
              placeholder="venue@example.com"
            />

            <Input
              label="Contact phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              maxLength={20}
              autoComplete="tel"
              placeholder="+66..."
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
              Save profile
            </Button>
          </CardContent>
        </div>
      </Card>
    </form>
  );
}
