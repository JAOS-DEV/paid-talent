"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { OPENING_NOTES_MAX_LENGTH } from "@/lib/recruiter-profile";
import {
  createOpening,
  updateOpening,
} from "@/lib/recruiter-profile/actions";
import type { RecruiterOpening } from "@/lib/db/schema";
import { emptyPayToNull } from "./format-pay";

interface OpeningFormProps {
  mode: "create" | "edit";
  initialOpening?: RecruiterOpening | null;
}

export function OpeningForm({
  mode,
  initialOpening = null,
}: OpeningFormProps): React.ReactElement {
  const router = useRouter();
  const [role, setRole] = useState(initialOpening?.role || "");
  const [area, setArea] = useState(initialOpening?.area || "");
  const [payMin, setPayMin] = useState(
    initialOpening?.payMin != null ? String(initialOpening.payMin) : ""
  );
  const [payMax, setPayMax] = useState(
    initialOpening?.payMax != null ? String(initialOpening.payMax) : ""
  );
  const [notes, setNotes] = useState(initialOpening?.notes || "");
  const [isPublished, setIsPublished] = useState(
    initialOpening?.isPublished ?? false
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (publish: boolean): Promise<void> => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      role,
      area,
      payMin: emptyPayToNull(payMin),
      payMax: emptyPayToNull(payMax),
      notes: notes.trim() === "" ? undefined : notes,
      isPublished: publish,
    };

    const result =
      mode === "create"
        ? await createOpening(payload)
        : await updateOpening({
            id: initialOpening!.id,
            ...payload,
          });

    setSaving(false);

    if (!result.success) {
      setError(result.error || "Failed to save opening");
      return;
    }

    if (mode === "create") {
      router.push("/recruiter/openings");
      router.refresh();
      return;
    }

    setIsPublished(publish);
    setSuccess("Opening saved");
    router.refresh();
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(isPublished);
      }}
    >
      <Card padding="lg">
        <CardHeader>
          <CardTitle>
            {mode === "create" ? "Add opening" : "Edit opening"}
          </CardTitle>
          <p className="text-sm text-charcoal-400 mt-1">
            Pay is shown to workers as THB / night when you publish.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Role *"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={100}
            required
            placeholder="e.g. Bartender"
          />

          <Input
            label="Area *"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            maxLength={100}
            required
            placeholder="e.g. Sukhumvit"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Minimum pay (THB / night)"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={payMin}
              onChange={(e) => setPayMin(e.target.value)}
              placeholder="Optional"
            />
            <Input
              label="Maximum pay (THB / night)"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={payMax}
              onChange={(e) => setPayMax(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <Textarea
              label="Notes"
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value.slice(0, OPENING_NOTES_MAX_LENGTH))
              }
              maxLength={OPENING_NOTES_MAX_LENGTH}
              aria-describedby="notes-counter"
            />
            <p
              id="notes-counter"
              className="mt-1 text-right text-xs text-charcoal-500"
            >
              {notes.length}/{OPENING_NOTES_MAX_LENGTH}
            </p>
          </div>

          {mode === "edit" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-charcoal-200">
                Visibility
              </legend>
              <label className="flex items-center gap-2 text-sm text-charcoal-300">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded border-charcoal-600"
                />
                Published (visible to workers)
              </label>
            </fieldset>
          )}

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

          {mode === "create" ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                fullWidth
                loading={saving}
                onClick={() => void submit(false)}
              >
                Save as Draft
              </Button>
              <Button
                type="button"
                fullWidth
                loading={saving}
                onClick={() => void submit(true)}
              >
                Publish
              </Button>
            </div>
          ) : (
            <Button type="submit" fullWidth loading={saving}>
              Save changes
            </Button>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
