"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components/layout";
import { Card, CardContent, Button } from "@/components/ui";
import { WorkerRequestCard } from "@/components/contact-requests";
import {
  InboundRequestControls,
  type InboundPrefs,
} from "@/components/notifications";
import type { InboxContactRequestDto } from "@/lib/contact-requests/queries";

export default function WorkerRequestsPage(): React.ReactElement {
  const t = useTranslations("contactRequests");
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<InboxContactRequestDto[]>([]);
  const [prefs, setPrefs] = useState<InboundPrefs | null>(null);
  const [loading, setLoading] = useState(true);

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
            <InboundRequestControls prefs={prefs} onSaved={setPrefs} />
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
                  <WorkerRequestCard
                    request={request}
                    onChanged={() => void load()}
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="pt-2">
            <Button type="button" variant="ghost" onClick={() => void load()}>
              {t("refresh")}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
