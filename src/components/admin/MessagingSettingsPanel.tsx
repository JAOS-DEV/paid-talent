"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";
import { ConfirmReasonDialog } from "@/components/admin/ConfirmReasonDialog";
import type { MessagingSettings } from "@/lib/messaging/settings";

interface MessagingSettingsPanelProps {
  settings: MessagingSettings & {
    updatedAt: string | null;
    updatedBy: string | null;
  };
  linePushUsage?: {
    month: string;
    pushesSent: number;
    budget: number;
  } | null;
}

type FieldKey = keyof MessagingSettings;

interface FieldDef {
  key: FieldKey;
  label: string;
  type: "number" | "boolean";
}

interface GroupDef {
  title: string;
  explanation: string;
  fields: FieldDef[];
}

const GROUPS: GroupDef[] = [
  {
    title: "Free recruiters",
    explanation:
      "Caps for verified free recruiters. Open Access never raises these numbers.",
    fields: [
      { key: "freeDailyNew", label: "Daily new requests", type: "number" },
      { key: "freeWeeklyNew", label: "Weekly new requests", type: "number" },
      { key: "freePendingMax", label: "Max pending requests", type: "number" },
      {
        key: "freeOpenerMaxChars",
        label: "Opener max characters",
        type: "number",
      },
      {
        key: "freeCanAttachOpening",
        label: "Can attach opening to first message",
        type: "boolean",
      },
      { key: "freeMaxVenues", label: "Max venues", type: "number" },
    ],
  },
  {
    title: "Pro recruiters",
    explanation:
      "Higher caps for paid or admin-granted recruiters, including Top Talent daily quota.",
    fields: [
      { key: "paidDailyNew", label: "Daily new requests", type: "number" },
      { key: "paidWeeklyNew", label: "Weekly new requests", type: "number" },
      {
        key: "paidDailyTopTalent",
        label: "Daily Top Talent requests",
        type: "number",
      },
      { key: "paidPendingMax", label: "Max pending requests", type: "number" },
      {
        key: "paidOpenerMaxChars",
        label: "Opener max characters",
        type: "number",
      },
      { key: "paidMaxVenues", label: "Max venues", type: "number" },
    ],
  },
  {
    title: "New recruiters",
    explanation:
      "Temporary daily hold applied after verification until the window expires.",
    fields: [
      {
        key: "newRecruiterDailyCap",
        label: "New recruiter daily cap",
        type: "number",
      },
      {
        key: "newRecruiterWindowDays",
        label: "New recruiter window (days)",
        type: "number",
      },
    ],
  },
  {
    title: "Workers",
    explanation:
      "Default inbound delivery budget per worker per Bangkok day before queueing.",
    fields: [
      {
        key: "workerInboundDailyDefault",
        label: "Default inbound daily limit",
        type: "number",
      },
    ],
  },
  {
    title: "Requests & chat",
    explanation:
      "Lifecycle timings and hard message length for request threads.",
    fields: [
      {
        key: "followUpAfterHours",
        label: "Follow-up after (hours)",
        type: "number",
      },
      {
        key: "requestExpiryDays",
        label: "Request expiry (days)",
        type: "number",
      },
      {
        key: "declineCooldownDays",
        label: "Decline cooldown (days)",
        type: "number",
      },
      {
        key: "messageMaxChars",
        label: "Message max characters",
        type: "number",
      },
    ],
  },
  {
    title: "Safety",
    explanation:
      "Auto-pause messaging when report volume crosses the threshold in the window.",
    fields: [
      {
        key: "autoPauseReportThreshold",
        label: "Auto-pause report threshold",
        type: "number",
      },
      {
        key: "autoPauseWindowDays",
        label: "Auto-pause window (days)",
        type: "number",
      },
    ],
  },
  {
    title: "Notifications",
    explanation:
      "Cooldown between push/email digests and monthly LINE push budget.",
    fields: [
      {
        key: "notifyCooldownMinutes",
        label: "Notify cooldown (minutes)",
        type: "number",
      },
      {
        key: "lineMonthlyPushBudget",
        label: "LINE monthly push budget",
        type: "number",
      },
    ],
  },
  {
    title: "Retention",
    explanation:
      "How long messaging artifacts are retained before cleanup jobs remove them.",
    fields: [
      { key: "retentionDays", label: "Retention (days)", type: "number" },
    ],
  },
];

function settingsToForm(
  settings: MessagingSettingsPanelProps["settings"]
): MessagingSettings {
  return {
    freeDailyNew: settings.freeDailyNew,
    freeWeeklyNew: settings.freeWeeklyNew,
    freePendingMax: settings.freePendingMax,
    freeOpenerMaxChars: settings.freeOpenerMaxChars,
    freeCanAttachOpening: settings.freeCanAttachOpening,
    freeMaxVenues: settings.freeMaxVenues,
    paidDailyNew: settings.paidDailyNew,
    paidWeeklyNew: settings.paidWeeklyNew,
    paidDailyTopTalent: settings.paidDailyTopTalent,
    paidPendingMax: settings.paidPendingMax,
    paidOpenerMaxChars: settings.paidOpenerMaxChars,
    paidMaxVenues: settings.paidMaxVenues,
    newRecruiterDailyCap: settings.newRecruiterDailyCap,
    newRecruiterWindowDays: settings.newRecruiterWindowDays,
    workerInboundDailyDefault: settings.workerInboundDailyDefault,
    followUpAfterHours: settings.followUpAfterHours,
    requestExpiryDays: settings.requestExpiryDays,
    declineCooldownDays: settings.declineCooldownDays,
    messageMaxChars: settings.messageMaxChars,
    autoPauseReportThreshold: settings.autoPauseReportThreshold,
    autoPauseWindowDays: settings.autoPauseWindowDays,
    notifyCooldownMinutes: settings.notifyCooldownMinutes,
    lineMonthlyPushBudget: settings.lineMonthlyPushBudget,
    retentionDays: settings.retentionDays,
  };
}

export function MessagingSettingsPanel({
  settings,
  linePushUsage = null,
}: MessagingSettingsPanelProps): React.ReactElement {
  const router = useRouter();
  const [form, setForm] = useState<MessagingSettings>(() =>
    settingsToForm(settings)
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [meta, setMeta] = useState({
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
  });

  const setNumberField = (key: FieldKey, value: string): void => {
    const parsed = Number(value);
    setForm((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  const setBooleanField = (key: FieldKey, checked: boolean): void => {
    setForm((prev) => ({
      ...prev,
      [key]: checked,
    }));
  };

  const submit = async (reasonText: string): Promise<void> => {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/admin/settings/messaging", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          reason: reasonText,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        errors?: Record<string, string[]>;
        settings?: {
          updatedAt: string | null;
          updatedBy: string | null;
        } & MessagingSettings;
      };
      if (!response.ok) {
        setError(data.error || "Could not update messaging settings");
        setFieldErrors(data.errors ?? {});
        return;
      }
      if (data.settings) {
        setForm(settingsToForm(data.settings));
        setMeta({
          updatedAt: data.settings.updatedAt,
          updatedBy: data.settings.updatedBy,
        });
      }
      setConfirmOpen(false);
      router.refresh();
    } catch {
      setError("Could not update messaging settings");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Messaging limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-charcoal-400">
          Runtime caps for request volume, openers, venues, and safety. Changes
          apply within about 5 seconds without a redeploy.
        </p>
        {meta.updatedAt && (
          <p className="text-sm text-charcoal-500">
            Last changed {new Date(meta.updatedAt).toLocaleString()}
            {meta.updatedBy ? ` by ${meta.updatedBy}` : ""}
          </p>
        )}
        {linePushUsage ? (
          <p className="text-sm text-charcoal-300">
            LINE pushes this month ({linePushUsage.month}):{" "}
            {linePushUsage.pushesSent} / {linePushUsage.budget}
          </p>
        ) : null}

        {GROUPS.map((group) => (
          <section key={group.title} className="space-y-3">
            <div>
              <h3 className="font-medium text-charcoal-100">{group.title}</h3>
              <p className="text-sm text-charcoal-400 mt-1">
                {group.explanation}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {group.fields.map((field) => {
                const fieldError = fieldErrors[field.key]?.[0];
                if (field.type === "boolean") {
                  return (
                    <label
                      key={field.key}
                      className="flex items-center gap-3 rounded-lg border border-charcoal-700 px-4 py-3 text-sm text-charcoal-200"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(form[field.key])}
                        onChange={(event) =>
                          setBooleanField(field.key, event.target.checked)
                        }
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                }
                return (
                  <Input
                    key={field.key}
                    label={field.label}
                    type="number"
                    value={String(form[field.key])}
                    error={fieldError}
                    onChange={(event) =>
                      setNumberField(field.key, event.target.value)
                    }
                  />
                );
              })}
            </div>
          </section>
        ))}

        {error && <p className="text-sm text-error">{error}</p>}

        <Button
          type="button"
          variant="gold"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          Save messaging limits
        </Button>
      </CardContent>

      <ConfirmReasonDialog
        open={confirmOpen}
        title="Save messaging limits"
        description="These caps apply immediately to new contact requests. Enter a short reason for the audit log."
        confirmLabel="Save messaging limits"
        busy={busy}
        error={error}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={(reasonText) => void submit(reasonText)}
      />
    </Card>
  );
}
