"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export interface InboundPrefs {
  dailyLimit: number;
  paused: boolean;
  defaultLimit: number;
}

interface InboundRequestControlsProps {
  prefs: InboundPrefs;
  onSaved?: (prefs: InboundPrefs) => void;
  /** Override card title; defaults to contactRequests.settings.title */
  title?: string;
}

export function InboundRequestControls({
  prefs: initial,
  onSaved,
  title,
}: InboundRequestControlsProps): React.ReactElement {
  const t = useTranslations("contactRequests");
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);

  const savePrefs = async (next: Partial<InboundPrefs>): Promise<void> => {
    setSaving(true);
    try {
      const res = await fetch("/api/worker/inbound-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyLimit: next.dailyLimit ?? prefs.dailyLimit,
          paused: next.paused ?? prefs.paused,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as InboundPrefs;
        setPrefs(updated);
        onSaved?.(updated);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>{title ?? t("settings.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label
            htmlFor="inbound-daily-limit"
            className="mb-1.5 block text-sm font-medium text-charcoal-200"
          >
            {t("settings.dailyLimit")}
          </label>
          <select
            id="inbound-daily-limit"
            value={prefs.dailyLimit}
            disabled={saving}
            onChange={(e) =>
              void savePrefs({ dailyLimit: Number(e.target.value) })
            }
            className="w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-4 py-2.5 text-charcoal-100 sm:max-w-xs"
          >
            {Array.from({ length: prefs.defaultLimit }, (_, i) => i + 1).map(
              (n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              )
            )}
          </select>
        </div>
        <label className="flex items-center gap-3 text-sm text-charcoal-200">
          <input
            type="checkbox"
            checked={prefs.paused}
            disabled={saving}
            onChange={(e) => void savePrefs({ paused: e.target.checked })}
            className="h-4 w-4"
          />
          {t("settings.pause")}
        </label>
      </CardContent>
    </Card>
  );
}
