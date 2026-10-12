"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { WorkerRequestCard } from "@/components/contact-requests";
import type { InboxContactRequestDto } from "@/lib/contact-requests/queries";

interface InboundPrefs {
  dailyLimit: number;
  paused: boolean;
  defaultLimit: number;
}

export default function WorkerRequestsPage(): React.ReactElement {
  const t = useTranslations("contactRequests");
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<InboxContactRequestDto[]>([]);
  const [prefs, setPrefs] = useState<InboundPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [inboxRes, prefsRes] = await Promise.all([
        fetch("/api/contact-requests?box=inbox"),
        fetch("/api/worker/inbound-settings"),
      ]);
      if (inboxRes.ok) {
        const data = await inboxRes.json();
        setRequests(data.requests ?? []);
      }
      if (prefsRes.ok) {
        setPrefs(await prefsRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

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

  if (!session || session.user.role !== "worker") {
    redirect("/auth/signin");
  }

  const savePrefs = async (next: Partial<InboundPrefs>): Promise<void> => {
    if (!prefs) return;
    setSavingPrefs(true);
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
        setPrefs(await res.json());
      }
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold text-charcoal-100">
              {t("inbox.title")}
            </h1>
            <p className="mt-1 text-charcoal-400">{t("inbox.subtitle")}</p>
          </div>

          {prefs ? (
            <Card padding="lg">
              <CardHeader>
                <CardTitle>{t("settings.title")}</CardTitle>
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
                    disabled={savingPrefs}
                    onChange={(e) =>
                      void savePrefs({ dailyLimit: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-4 py-2.5 text-charcoal-100 sm:max-w-xs"
                  >
                    {Array.from(
                      { length: prefs.defaultLimit },
                      (_, i) => i + 1
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-3 text-sm text-charcoal-200">
                  <input
                    type="checkbox"
                    checked={prefs.paused}
                    disabled={savingPrefs}
                    onChange={(e) =>
                      void savePrefs({ paused: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  {t("settings.pause")}
                </label>
              </CardContent>
            </Card>
          ) : null}

          {loading ? (
            <p className="text-charcoal-400">{t("loading")}</p>
          ) : requests.length === 0 ? (
            <Card padding="lg">
              <CardContent>
                <p className="text-charcoal-400">{t("inbox.empty")}</p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-4">
              {requests.map((request) => (
                <li key={request.id}>
                  <WorkerRequestCard request={request} onChanged={() => void load()} />
                </li>
              ))}
            </ul>
          )}

          <div className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void load()}
            >
              {t("refresh")}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
