"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components/layout";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  InboundRequestControls,
  type InboundPrefs,
} from "@/components/notifications";

interface NotificationPrefsState {
  emailEnabled: boolean;
  lineEnabled: boolean;
  locale: "en" | "th";
  lineConfigured: boolean;
  emailConfigured: boolean;
}

export default function NotificationSettingsPage(): React.ReactElement {
  const t = useTranslations("notifications");
  const { data: session, status } = useSession();
  const [prefs, setPrefs] = useState<NotificationPrefsState | null>(null);
  const [inbound, setInbound] = useState<InboundPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const [prefsRes, inboundRes] = await Promise.all([
      fetch("/api/notification-prefs"),
      session?.user?.role === "worker"
        ? fetch("/api/worker/inbound-settings")
        : Promise.resolve(null),
    ]);
    if (prefsRes.ok) {
      setPrefs(await prefsRes.json());
    }
    if (inboundRes?.ok) {
      setInbound(await inboundRes.json());
    }
  }, [session?.user?.role]);

  useEffect(() => {
    if (status === "authenticated") {
      void load();
    }
  }, [status, load]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!session?.user || session.user.signupPending) {
    redirect("/auth/signin");
  }

  const save = async (
    patch: Partial<Pick<NotificationPrefsState, "emailEnabled" | "lineEnabled" | "locale">>
  ): Promise<void> => {
    if (!prefs) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/notification-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailEnabled: patch.emailEnabled ?? prefs.emailEnabled,
          lineEnabled: patch.lineEnabled ?? prefs.lineEnabled,
          locale: patch.locale ?? prefs.locale,
        }),
      });
      if (res.ok) {
        setPrefs(await res.json());
        setMessage(t("settings.saved"));
      } else {
        setMessage(t("settings.saveFailed"));
      }
    } catch {
      setMessage(t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold text-charcoal-100">
              {t("settings.title")}
            </h1>
            <p className="mt-1 text-charcoal-400">{t("settings.subtitle")}</p>
          </div>

          {prefs ? (
            <Card padding="lg">
              <CardHeader>
                <CardTitle>{t("settings.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-3 text-sm text-charcoal-200">
                  <input
                    type="checkbox"
                    checked={prefs.emailEnabled}
                    disabled={saving}
                    onChange={(e) =>
                      void save({ emailEnabled: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  {t("settings.emailEnabled")}
                </label>

                <label className="flex items-start gap-3 text-sm text-charcoal-200">
                  <input
                    type="checkbox"
                    checked={prefs.lineEnabled}
                    disabled
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    {t("settings.lineEnabled")}
                    <span className="mt-0.5 block text-xs text-charcoal-400">
                      {t("settings.lineComingSoon")}
                    </span>
                  </span>
                </label>

                <div>
                  <label
                    htmlFor="notification-locale"
                    className="mb-1.5 block text-sm font-medium text-charcoal-200"
                  >
                    {t("settings.locale")}
                  </label>
                  <select
                    id="notification-locale"
                    value={prefs.locale}
                    disabled={saving}
                    onChange={(e) =>
                      void save({
                        locale: e.target.value === "th" ? "th" : "en",
                      })
                    }
                    className="w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-4 py-2.5 text-charcoal-100 sm:max-w-xs"
                  >
                    <option value="en">{t("settings.localeEn")}</option>
                    <option value="th">{t("settings.localeTh")}</option>
                  </select>
                </div>

                {message ? (
                  <p className="text-sm text-charcoal-300">{message}</p>
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => void save({})}
                >
                  {t("settings.save")}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {session.user.role === "worker" && inbound ? (
            <InboundRequestControls
              prefs={inbound}
              title={t("settings.inboundTitle")}
              onSaved={setInbound}
            />
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}
