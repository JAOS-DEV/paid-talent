"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components/layout";
import {
  Button,
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
import {
  InboundRequestControls,
  type InboundPrefs,
} from "@/components/notifications";

interface NotificationPrefsState {
  emailEnabled: boolean;
  lineEnabled: boolean;
  locale: "en" | "th";
  lineConfigured: boolean;
  lineMessagingConfigured: boolean;
  emailConfigured: boolean;
  lineLink: null | {
    displayName: string | null;
    isFriend: boolean;
  };
  lineBudgetExhausted: boolean;
  lineOaAddFriendUrl: string | null;
}

export default function NotificationSettingsPage(): React.ReactElement {
  const t = useTranslations("notifications");
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [prefs, setPrefs] = useState<NotificationPrefsState | null>(null);
  const [inbound, setInbound] = useState<InboundPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);

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

  useEffect(() => {
    const line = searchParams.get("line");
    if (line === "linked") {
      setMessage(t("settings.lineLinked"));
    } else if (line === "already_linked") {
      setMessage(t("settings.lineAlreadyLinked"));
    } else if (line === "error") {
      setMessage(t("settings.lineLinkError"));
    }
  }, [searchParams, t]);

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
    patch: Partial<
      Pick<NotificationPrefsState, "emailEnabled" | "lineEnabled" | "locale">
    >
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

  const unlinkLine = async (): Promise<void> => {
    setUnlinking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/line/unlink", { method: "POST" });
      if (res.ok) {
        await load();
        setMessage(t("settings.saved"));
      } else {
        setMessage(t("settings.saveFailed"));
      }
    } catch {
      setMessage(t("settings.saveFailed"));
    } finally {
      setUnlinking(false);
    }
  };

  const lineToggleEnabled =
    Boolean(prefs?.lineConfigured) &&
    Boolean(prefs?.lineLink?.isFriend) &&
    !saving;

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
                  <Checkbox
                    checked={prefs.emailEnabled}
                    disabled={saving}
                    onCheckedChange={(checked) =>
                      void save({ emailEnabled: checked === true })
                    }
                  />
                  {t("settings.emailEnabled")}
                </label>

                {!prefs.lineConfigured ? (
                  <label className="flex items-start gap-3 text-sm text-charcoal-200">
                    <Checkbox
                      checked={prefs.lineEnabled}
                      disabled
                      className="mt-0.5"
                    />
                    <span>
                      {t("settings.lineEnabled")}
                      <span className="mt-0.5 block text-xs text-charcoal-400">
                        {t("settings.lineComingSoon")}
                      </span>
                    </span>
                  </label>
                ) : (
                  <div className="space-y-3 rounded-lg border border-charcoal-700 px-4 py-3">
                    <p className="text-sm font-medium text-charcoal-100">
                      {t("settings.lineSectionTitle")}
                    </p>

                    {!prefs.lineLink ? (
                      <div className="space-y-2">
                        <p className="text-sm text-charcoal-300">
                          {t("settings.lineConnectExplain")}
                        </p>
                        <Button
                          type="button"
                          variant="gold"
                          onClick={() => {
                            window.location.href = "/api/line/link/start";
                          }}
                        >
                          {t("settings.lineConnect")}
                        </Button>
                      </div>
                    ) : !prefs.lineLink.isFriend ? (
                      <div className="space-y-2">
                        <p className="text-sm text-charcoal-300">
                          {t("settings.lineAddFriendExplain")}
                        </p>
                        {prefs.lineOaAddFriendUrl ? (
                          <a
                            href={prefs.lineOaAddFriendUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex text-sm font-medium text-primary-400 underline"
                          >
                            {t("settings.lineAddFriend")}
                          </a>
                        ) : null}
                        <div>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={unlinking}
                            onClick={() => void unlinkLine()}
                          >
                            {t("settings.lineDisconnect")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-charcoal-200">
                          {prefs.lineLink.displayName
                            ? t("settings.lineConnectedAs", {
                                displayName: prefs.lineLink.displayName,
                              })
                            : t("settings.lineConnected")}
                        </p>
                        <label className="flex items-center gap-3 text-sm text-charcoal-200">
                          <Checkbox
                            checked={prefs.lineEnabled}
                            disabled={!lineToggleEnabled}
                            onCheckedChange={(checked) =>
                              void save({ lineEnabled: checked === true })
                            }
                          />
                          {t("settings.lineEnabled")}
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={unlinking}
                          onClick={() => void unlinkLine()}
                        >
                          {t("settings.lineDisconnect")}
                        </Button>
                      </div>
                    )}

                    {prefs.lineBudgetExhausted ? (
                      <p className="text-sm text-amber-400">
                        {t("settings.lineBudgetWarning")}
                      </p>
                    ) : null}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="notification-locale"
                    className="mb-1.5 block text-sm font-medium text-charcoal-200"
                  >
                    {t("settings.locale")}
                  </label>
                  <Select
                    value={prefs.locale}
                    disabled={saving}
                    onValueChange={(value) =>
                      void save({ locale: value === "th" ? "th" : "en" })
                    }
                  >
                    <SelectTrigger id="notification-locale" className="sm:max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t("settings.localeEn")}</SelectItem>
                      <SelectItem value="th">{t("settings.localeTh")}</SelectItem>
                    </SelectContent>
                  </Select>
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
