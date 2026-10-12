"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import type { RecruiterAccessDto } from "@/lib/recruiter-access";
import type { LimitsWithRemaining } from "@/lib/contact-requests/service";

interface VenueOption {
  id: string;
  name: string;
  isPrimary: boolean;
  reviewStatus: string;
}

interface OpeningOption {
  id: string;
  role: string;
  area: string;
  isPublished: boolean;
  venueId: string | null;
}

interface LimitsResponse {
  access: RecruiterAccessDto;
  limits: LimitsWithRemaining;
  followUpAfterHours: number;
  requestExpiryDays: number;
}

interface SendContactRequestDialogProps {
  workerProfileId: string;
  workerDisplayName?: string;
  isTopTalent?: boolean;
  open: boolean;
  onClose: () => void;
  onSent?: (requestId: string) => void;
}

function hoursUntil(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (60 * 60 * 1000)));
}

export function SendContactRequestDialog({
  workerProfileId,
  workerDisplayName,
  isTopTalent = false,
  open,
  onClose,
  onSent,
}: SendContactRequestDialogProps): React.ReactElement | null {
  const t = useTranslations("contactRequests");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [access, setAccess] = useState<RecruiterAccessDto | null>(null);
  const [limits, setLimits] = useState<LimitsWithRemaining | null>(null);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [openings, setOpenings] = useState<OpeningOption[]>([]);
  const [venueId, setVenueId] = useState("");
  const [openingId, setOpeningId] = useState("");
  const [openerText, setOpenerText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [limitsRes, venuesRes, openingsRes] = await Promise.all([
        fetch("/api/contact-requests/limits"),
        fetch("/api/recruiter/venues"),
        fetch("/api/recruiter/openings"),
      ]);

      if (limitsRes.ok) {
        const data = (await limitsRes.json()) as LimitsResponse;
        setAccess(data.access);
        setLimits(data.limits);
        const primary = data.access.primaryVenueId;
        if (data.access.tier === "free" && primary) {
          setVenueId(primary);
        } else if (primary) {
          setVenueId(primary);
        }
      }

      if (venuesRes.ok) {
        const data = await venuesRes.json();
        const approved = ((data.venues ?? []) as VenueOption[]).filter(
          (v) => v.reviewStatus === "approved"
        );
        setVenues(approved);
      }

      if (openingsRes.ok) {
        const data = await openingsRes.json();
        setOpenings(
          ((data.openings ?? []) as OpeningOption[]).filter((o) => o.isPublished)
        );
      }
    } catch {
      setError(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  if (!open) return null;

  const maxChars = limits?.openerMaxChars ?? 300;
  const canAttach = limits?.canAttachOpening === true;
  const venueOptions =
    access?.tier === "free" && access.primaryVenueId
      ? venues.filter((v) => v.id === access.primaryVenueId)
      : venues.filter((v) => access?.approvedVenueIds.includes(v.id));

  const openingsForVenue = openings.filter(
    (o) => !venueId || o.venueId === venueId || o.venueId == null
  );

  const mapError = (code: string, retryAfter?: string): string => {
    const hours = hoursUntil(retryAfter);
    switch (code) {
      case "daily_limit":
      case "new_recruiter_daily_limit":
        return t("errors.dailyLimit", {
          count: limits?.dailyNew ?? 3,
          hours: hours ?? 1,
        });
      case "weekly_limit":
        return t("errors.weeklyLimit");
      case "pending_limit":
        return t("errors.pendingLimit");
      case "top_talent_requires_pro":
        return t("errors.topTalentRequiresPro");
      case "top_talent_daily_limit":
        return t("errors.topTalentDailyLimit");
      case "contact_info_blocked":
        return t("errors.contactInfoBlocked");
      case "duplicate":
        return t("errors.duplicate");
      case "decline_cooldown":
        return t("errors.declineCooldown");
      case "opener_too_long":
        return t("errors.openerTooLong");
      case "opening_attach_requires_pro":
        return t("errors.openingAttachRequiresPro");
      case "venue_not_primary":
        return t("errors.venueNotPrimary");
      case "paused":
        return t("errors.paused");
      case "not_verified":
        return t("errors.notVerified");
      default:
        return t("errors.generic");
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!venueId || !openerText.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/contact-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerProfileId,
          venueId,
          openerText: openerText.trim(),
          openingId: canAttach && openingId ? openingId : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(mapError(data.code ?? "generic", data.retryAfter));
        return;
      }
      onSent?.(data.request.id);
      onClose();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-contact-request-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-charcoal-700 bg-charcoal-900 p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="send-contact-request-title"
              className="text-lg font-semibold text-charcoal-100"
            >
              {t("dialog.title")}
            </h2>
            {workerDisplayName ? (
              <p className="mt-1 text-sm text-charcoal-400">
                {t("dialog.toWorker", { name: workerDisplayName })}
              </p>
            ) : null}
            {isTopTalent ? (
              <p className="mt-1 text-xs text-gold-400">{t("dialog.topTalent")}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-charcoal-400 hover:text-charcoal-200"
            aria-label={t("dialog.close")}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-charcoal-400">{t("loading")}</div>
        ) : (
          <div className="space-y-4">
            {limits ? (
              <p className="text-sm text-charcoal-400">
                {t("dialog.remaining", {
                  daily: limits.remainingDaily,
                  weekly: limits.remainingWeekly,
                })}
              </p>
            ) : null}

            <div>
              <label
                htmlFor="contact-request-venue"
                className="mb-1.5 block text-sm font-medium text-charcoal-200"
              >
                {t("dialog.venue")}
              </label>
              <select
                id="contact-request-venue"
                value={venueId}
                onChange={(e) => {
                  setVenueId(e.target.value);
                  setOpeningId("");
                }}
                disabled={access?.tier === "free"}
                className="w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-4 py-2.5 text-charcoal-100"
              >
                <option value="">{t("dialog.selectVenue")}</option>
                {venueOptions.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                    {venue.isPrimary ? ` (${t("dialog.primary")})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="contact-request-opening"
                className="mb-1.5 block text-sm font-medium text-charcoal-200"
              >
                {t("dialog.opening")}
              </label>
              <select
                id="contact-request-opening"
                value={openingId}
                onChange={(e) => setOpeningId(e.target.value)}
                disabled={!canAttach}
                className="w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-4 py-2.5 text-charcoal-100 disabled:opacity-60"
              >
                <option value="">{t("dialog.noOpening")}</option>
                {openingsForVenue.map((opening) => (
                  <option key={opening.id} value={opening.id}>
                    {opening.role} · {opening.area}
                  </option>
                ))}
              </select>
              {!canAttach ? (
                <p className="mt-1.5 text-xs text-gold-400" data-testid="opening-upsell">
                  {t("dialog.openingUpsell")}
                </p>
              ) : null}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="contact-request-opener"
                  className="text-sm font-medium text-charcoal-200"
                >
                  {t("dialog.opener")}
                </label>
                <span
                  className="text-xs text-charcoal-500"
                  data-testid="opener-char-counter"
                >
                  {openerText.length}/{maxChars}
                </span>
              </div>
              <textarea
                id="contact-request-opener"
                value={openerText}
                onChange={(e) => setOpenerText(e.target.value.slice(0, maxChars))}
                rows={4}
                maxLength={maxChars}
                className="w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-4 py-2.5 text-charcoal-100"
                placeholder={t("dialog.openerPlaceholder")}
              />
            </div>

            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                type="button"
                variant="primary"
                fullWidth
                disabled={!venueId || !openerText.trim() || submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting ? t("dialog.sending") : t("dialog.send")}
              </Button>
              <Button type="button" variant="secondary" fullWidth onClick={onClose}>
                {t("dialog.cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
