"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

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
          <Select
            value={String(prefs.dailyLimit)}
            disabled={saving}
            onValueChange={(value) =>
              void savePrefs({ dailyLimit: Number(value) })
            }
          >
            <SelectTrigger id="inbound-daily-limit" className="sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: prefs.defaultLimit }, (_, i) => i + 1).map(
                (n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-3 text-sm text-charcoal-200">
          <Checkbox
            checked={prefs.paused}
            disabled={saving}
            onCheckedChange={(checked) =>
              void savePrefs({ paused: checked === true })
            }
          />
          {t("settings.pause")}
        </label>
      </CardContent>
    </Card>
  );
}
