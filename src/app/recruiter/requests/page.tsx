"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components/layout";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { SentContactRequestDto } from "@/lib/contact-requests/queries";
import type { LimitsWithRemaining } from "@/lib/contact-requests/service";

const STATUS_ORDER = [
  "queued",
  "pending",
  "accepted",
  "declined",
  "expired",
  "withdrawn",
] as const;

export default function RecruiterRequestsPage(): React.ReactElement {
  const t = useTranslations("contactRequests");
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<SentContactRequestDto[]>([]);
  const [limits, setLimits] = useState<LimitsWithRemaining | null>(null);
  const [loading, setLoading] = useState(true);
  const [followUpId, setFollowUpId] = useState<string | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch("/api/contact-requests?box=sent");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
        setLimits(data.limits ?? null);
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

  if (!session || session.user.role !== "recruiter") {
    redirect("/auth/signin");
  }

  const sendFollowUp = async (id: string): Promise<void> => {
    setError(null);
    const res = await fetch(`/api/contact-requests/${id}/follow-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: followUpText }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? t("errors.generic"));
      return;
    }
    setFollowUpId(null);
    setFollowUpText("");
    await load();
  };

  const withdraw = async (id: string): Promise<void> => {
    await fetch(`/api/contact-requests/${id}/withdraw`, { method: "POST" });
    await load();
  };

  const grouped = STATUS_ORDER.map((statusKey) => ({
    status: statusKey,
    items: requests.filter((r) => r.status === statusKey),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold text-charcoal-100">
              {t("sent.title")}
            </h1>
            <p className="mt-1 text-charcoal-400">{t("sent.subtitle")}</p>
            {limits ? (
              <p className="mt-2 text-sm text-charcoal-500">
                {t("dialog.remaining", {
                  daily: limits.remainingDaily,
                  weekly: limits.remainingWeekly,
                })}
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-charcoal-400">{t("loading")}</p>
          ) : grouped.length === 0 ? (
            <Card padding="lg">
              <CardContent>
                <p className="text-charcoal-400">{t("sent.empty")}</p>
              </CardContent>
            </Card>
          ) : (
            grouped.map((group) => (
              <section key={group.status} className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">
                  {t(`status.${group.status}`)}
                </h2>
                {group.items.map((request) => (
                  <Card key={request.id} padding="lg">
                    <CardHeader>
                      <CardTitle className="text-base">
                        {request.workerDisplayName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {request.venueName ? (
                        <p className="text-sm text-charcoal-400">
                          {request.venueName}
                        </p>
                      ) : null}
                      {request.openingSummary ? (
                        <p className="text-sm text-charcoal-400">
                          {request.openingSummary}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap text-sm text-charcoal-200">
                        {request.openerText}
                      </p>
                      {request.status === "accepted" &&
                      request.conversationId ? (
                        <Link
                          href={`/recruiter/messages/${request.conversationId}`}
                          className="inline-flex text-sm font-medium text-primary-400 hover:text-primary-300"
                        >
                          {t("sent.openChat")}
                        </Link>
                      ) : null}
                      {(request.status === "pending" ||
                        request.status === "queued") && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => void withdraw(request.id)}
                        >
                          {t("sent.withdraw")}
                        </Button>
                      )}
                      {request.followUpEligible ? (
                        followUpId === request.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={followUpText}
                              onChange={(e) => setFollowUpText(e.target.value)}
                              rows={3}
                              className="w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-charcoal-100"
                              placeholder={t("sent.followUpPlaceholder")}
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="primary"
                                onClick={() => void sendFollowUp(request.id)}
                              >
                                {t("sent.sendFollowUp")}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setFollowUpId(null)}
                              >
                                {t("dialog.cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setFollowUpId(request.id)}
                          >
                            {t("sent.followUp")}
                          </Button>
                        )
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </section>
            ))
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
