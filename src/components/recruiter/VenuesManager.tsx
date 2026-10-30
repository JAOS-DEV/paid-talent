"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
} from "@/components/ui";
import { VenueLogoPicker } from "@/components/recruiter/VenueLogoPicker";
import type { Venue, VenueReviewStatus } from "@/lib/db/schema";
import { BLURB_MAX_LENGTH } from "@/lib/recruiter-profile";

interface VenuesResponse {
  venues: Venue[];
  maxVenues: number;
}

function statusLabel(
  status: VenueReviewStatus,
  t: ReturnType<typeof useTranslations<"recruiter.venues">>
): string {
  switch (status) {
    case "pending":
      return t("statusPending");
    case "approved":
      return t("statusApproved");
    case "rejected":
      return t("statusRejected");
  }
}

function statusVariant(
  status: VenueReviewStatus
): "warning" | "success" | "error" {
  switch (status) {
    case "pending":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "error";
  }
}

interface VenueFormState {
  name: string;
  area: string;
  subArea: string;
  blurb: string;
  venueLinkUrl: string;
  isPrimary: boolean;
}

const emptyForm = (): VenueFormState => ({
  name: "",
  area: "",
  subArea: "",
  blurb: "",
  venueLinkUrl: "",
  isPrimary: false,
});

export function VenuesManager(): React.ReactElement {
  const t = useTranslations("recruiter.venues");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [maxVenues, setMaxVenues] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<VenueFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recruiter/venues");
      const data = (await res.json()) as VenuesResponse & { error?: string };
      if (!res.ok) {
        setError(data.error || t("loadFailed"));
        return;
      }
      setVenues(data.venues);
      setMaxVenues(data.maxVenues);
    } catch {
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const startCreate = (): void => {
    setCreating(true);
    setEditingId(null);
    setForm(emptyForm());
    setLogoUrl(null);
    setError(null);
  };

  const startEdit = (venue: Venue): void => {
    setCreating(false);
    setEditingId(venue.id);
    setForm({
      name: venue.name,
      area: venue.area ?? "",
      subArea: venue.subArea ?? "",
      blurb: venue.blurb ?? "",
      venueLinkUrl: venue.venueLinkUrl,
      isPrimary: venue.isPrimary,
    });
    setLogoUrl(venue.logoUrl);
    setError(null);
  };

  const cancelForm = (): void => {
    setCreating(false);
    setEditingId(null);
    setForm(emptyForm());
    setLogoUrl(null);
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        area: form.area || null,
        subArea: form.subArea || null,
        blurb: form.blurb || null,
        venueLinkUrl: form.venueLinkUrl,
        isPrimary: form.isPrimary,
      };

      const res = editingId
        ? await fetch(`/api/recruiter/venues/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/recruiter/venues", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || t("saveFailed"));
        return;
      }

      cancelForm();
      await load();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const archive = async (venueId: string): Promise<void> => {
    setError(null);
    try {
      const res = await fetch(`/api/recruiter/venues/${venueId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || t("archiveFailed"));
        return;
      }
      await load();
    } catch {
      setError(t("archiveFailed"));
    }
  };

  const setPrimary = async (venueId: string): Promise<void> => {
    setError(null);
    try {
      const res = await fetch(`/api/recruiter/venues/${venueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setPrimaryOnly: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || t("saveFailed"));
        return;
      }
      await load();
    } catch {
      setError(t("saveFailed"));
    }
  };

  const canAdd = venues.length < maxVenues;
  const showForm = creating || editingId !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal-100">
            {t("title")}
          </h1>
          <p className="text-charcoal-400 mt-1">{t("subtitle")}</p>
          {loading ? (
            <div
              className="mt-2 h-5 w-32 animate-pulse rounded bg-charcoal-800"
              data-testid="venues-limit-skeleton"
            />
          ) : (
            <p className="mt-2 text-sm text-charcoal-300">
              {t("limit", { count: venues.length, max: maxVenues })}
            </p>
          )}
        </div>
        {!showForm && (
          <Button onClick={startCreate} disabled={!canAdd}>
            {t("addVenue")}
          </Button>
        )}
      </div>

      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <Card padding="lg">
          <CardContent className="space-y-4 !p-0">
            <h2 className="text-lg font-semibold text-charcoal-100">
              {editingId ? t("editVenue") : t("addVenue")}
            </h2>

            {editingId ? (
              <VenueLogoPicker
                logoUrl={logoUrl}
                venueId={editingId}
                onChange={(next) => setLogoUrl(next.logoUrl)}
              />
            ) : null}

            <Input
              id="venue-name"
              label={t("name")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={100}
            />
            <Input
              id="venue-area"
              label={t("area")}
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              maxLength={100}
            />
            <Input
              id="venue-sub-area"
              label={t("subArea")}
              value={form.subArea}
              onChange={(e) => setForm({ ...form, subArea: e.target.value })}
              maxLength={100}
            />
            <div>
              <Textarea
                label={t("blurb")}
                value={form.blurb}
                onChange={(e) =>
                  setForm({
                    ...form,
                    blurb: e.target.value.slice(0, BLURB_MAX_LENGTH),
                  })
                }
                maxLength={BLURB_MAX_LENGTH}
              />
            </div>
            <div>
              <Input
                id="venue-link"
                label={t("venueLink")}
                value={form.venueLinkUrl}
                onChange={(e) =>
                  setForm({ ...form, venueLinkUrl: e.target.value })
                }
                required
                placeholder="https://maps.app.goo.gl/..."
              />
              <p className="text-xs text-charcoal-300 mt-1.5">
                {t("venueLinkHelp")}
              </p>
            </div>
            <label className="flex items-center gap-3 text-sm text-charcoal-300 min-h-[44px]">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) =>
                  setForm({ ...form, isPrimary: e.target.checked })
                }
                className="w-5 h-5 rounded border-charcoal-600 bg-charcoal-800 text-primary-600"
              />
              {t("setPrimary")}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                fullWidth
                loading={saving}
                onClick={() => void save()}
              >
                {t("save")}
              </Button>
              <Button
                fullWidth
                variant="outline"
                disabled={saving}
                onClick={cancelForm}
              >
                {t("cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-charcoal-800" />
      ) : venues.length === 0 ? (
        <Card padding="lg">
          <CardContent className="text-center py-10">
            <p className="text-charcoal-100 font-medium">{t("emptyTitle")}</p>
            <p className="text-charcoal-400 mt-2">{t("emptyBody")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {venues.map((venue) => (
            <Card key={venue.id} padding="lg">
              <CardContent className="!p-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-charcoal-100">
                        {venue.name}
                      </h3>
                      <Badge variant={statusVariant(venue.reviewStatus)}>
                        {statusLabel(venue.reviewStatus, t)}
                      </Badge>
                      {venue.isPrimary ? (
                        <Badge variant="default">{t("primary")}</Badge>
                      ) : null}
                    </div>
                    {venue.area ? (
                      <p className="text-sm text-charcoal-400 mt-1">
                        {venue.area}
                        {venue.subArea ? ` · ${venue.subArea}` : ""}
                      </p>
                    ) : null}
                    {venue.reviewStatus === "rejected" && venue.reviewNote ? (
                      <p className="text-sm text-amber-300 mt-2">
                        {t("reviewNote")}: {venue.reviewNote}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() => startEdit(venue)}
                  >
                    {t("edit")}
                  </Button>
                  {!venue.isPrimary ? (
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => void setPrimary(venue.id)}
                    >
                      {t("makePrimary")}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    fullWidth
                    className="text-charcoal-400 hover:text-red-300"
                    onClick={() => void archive(venue.id)}
                  >
                    {t("archive")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
