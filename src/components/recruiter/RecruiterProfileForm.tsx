"use client";

import React, { useMemo, useState } from "react";
import {
  Button,
  Input,
  Textarea,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card padding="lg">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Venue profile</CardTitle>
              <p className="text-sm text-charcoal-400 mt-1">
                This is what workers see when you express interest — your venue
                or company identity.
              </p>
            </div>
            {completeness.isComplete ? (
              <Badge variant="success">Venue profile complete</Badge>
            ) : (
              <Badge variant="warning">Complete your venue profile</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!completeness.isComplete && (
            <div
              className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200"
              role="status"
            >
              <p className="font-medium">Complete your venue profile</p>
              {missingRequired.length > 0 && (
                <p className="mt-1 text-yellow-200/80">
                  Missing: {missingRequired.join(", ")}
                </p>
              )}
            </div>
          )}

          <Input
            label="Venue / organisation name *"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            maxLength={100}
            required
            autoComplete="organization"
          />

          <Input
            label="Area *"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            maxLength={100}
            required
            helperText="Primary area where you hire (e.g. Sukhumvit, Walking Street)"
          />

          <Input
            label="Sub-area"
            value={subArea}
            onChange={(e) => setSubArea(e.target.value)}
            maxLength={100}
            helperText="Optional district or soi"
          />

          <div>
            <Textarea
              label="About your venue *"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value.slice(0, BLURB_MAX_LENGTH))}
              maxLength={BLURB_MAX_LENGTH}
              required
              aria-describedby="blurb-counter"
            />
            <p
              id="blurb-counter"
              className="mt-1 text-right text-xs text-charcoal-500"
            >
              {blurb.length}/{BLURB_MAX_LENGTH}
            </p>
          </div>

          <Input
            label="Contact email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            autoComplete="email"
          />

          <Input
            label="Contact phone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            maxLength={20}
            autoComplete="tel"
          />

          <p className="text-xs text-charcoal-500">
            Logo upload is not available in this release. You can add a logo
            later when recruiter media support ships.
          </p>

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
      </Card>
    </form>
  );
}
