"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, redirect } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components/layout";
import {
  Button,
  Card,
  CardContent,
} from "@/components/ui";
import {
  HireOutcomeStatusBadge,
  HireOutcomeActions,
} from "@/components/hire-outcomes";
import { OpeningInterestSelect } from "@/components/recruiter";
import { WorkerPublicProfileView } from "@/components/worker-profile";
import type { WorkerProfileDetail } from "@/app/api/workers/[id]/route";
import type {
  HireConfirmationRequestStatus,
  HireConfirmationRequestedStatus,
  HireOutcomeStatus,
  RecruiterOpening,
} from "@/lib/db/schema";

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

interface InterestOutcomeData {
  interestId: string;
  status: HireOutcomeStatus;
  hiredAt: string | null;
  startedAt: string | null;
  confirmationRequest: {
    requestedStatus: HireConfirmationRequestedStatus;
    requestStatus: HireConfirmationRequestStatus;
  } | null;
}

export default function ProfileDetailPage({
  params,
}: ProfilePageProps): React.ReactElement {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("recruiter.workerDetail");
  const [profile, setProfile] = useState<WorkerProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interestLoading, setInterestLoading] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [interestOutcome, setInterestOutcome] =
    useState<InterestOutcomeData | null>(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState("");
  const [publishedOpenings, setPublishedOpenings] = useState<
    Pick<
      RecruiterOpening,
      | "id"
      | "role"
      | "area"
      | "isPublished"
      | "payMin"
      | "payMax"
      | "payCurrency"
      | "payPeriod"
    >[]
  >([]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    const loadOpenings = async (): Promise<void> => {
      try {
        const response = await fetch("/api/recruiter/openings");
        if (cancelled) return;
        if (!response.ok) {
          setPublishedOpenings([]);
          return;
        }
        const data = await response.json();
        const openings = (data.openings || []) as RecruiterOpening[];
        setPublishedOpenings(
          openings
            .filter((o) => o.isPublished)
            .map((o) => ({
              id: o.id,
              role: o.role,
              area: o.area,
              isPublished: o.isPublished,
              payMin: o.payMin,
              payMax: o.payMax,
              payCurrency: o.payCurrency,
              payPeriod: o.payPeriod,
            }))
        );
      } catch {
        if (!cancelled) {
          setPublishedOpenings([]);
        }
      }
    };

    void loadOpenings();

    const loadProfile = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/workers/${id}`);
        if (cancelled) return;
        if (response.ok) {
          const data = await response.json();
          setProfile(data.profile);
          setInterestSent(data.profile.hasExpressedInterest);

          if (data.profile.hasExpressedInterest && data.profile.interestId) {
            setInterestOutcome({
              interestId: data.profile.interestId,
              status: data.profile.hireOutcomeStatus ?? "interested",
              hiredAt: data.profile.hiredAt ?? null,
              startedAt: data.profile.startedAt ?? null,
              confirmationRequest: data.profile.confirmationRequest ?? null,
            });
          }
        } else if (response.status === 404) {
          setError(t("profileNotFound"));
        } else {
          setError(t("loadFailed"));
        }
      } catch {
        if (!cancelled) {
          setError(t("loadFailed"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [status, id, t]);

  const handleExpressInterest = async (): Promise<void> => {
    if (!profile || interestSent || interestLoading) return;

    try {
      setInterestLoading(true);
      const response = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerProfileId: profile.id,
          openingId: selectedOpeningId || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setInterestSent(true);
        if (data.interestId) {
          setInterestOutcome({
            interestId: data.interestId,
            status: "interested",
            confirmationRequest: null,
            hiredAt: null,
            startedAt: null,
          });
        }
      } else if (response.status === 409) {
        setInterestSent(true);
      }
    } catch (err) {
      console.error("Failed to express interest:", err);
    } finally {
      setInterestLoading(false);
    }
  };

  const handleUnlock = async (): Promise<void> => {
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          router.push(data.url);
        }
      }
    } catch (err) {
      console.error("Failed to start checkout:", err);
    }
  };

  const handleRequestCreated = useCallback(
    (requestedStatus: HireConfirmationRequestedStatus) => {
      setInterestOutcome((prev) =>
        prev
          ? {
              ...prev,
              confirmationRequest: {
                requestedStatus,
                requestStatus: "pending",
              },
            }
          : null
      );
    },
    []
  );

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session || session.user.role !== "recruiter") {
    redirect("/auth/signin");
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 bg-charcoal-950 py-8">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card padding="lg">
              <CardContent className="text-center py-12">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-charcoal-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <h2 className="text-xl font-semibold text-charcoal-100 mb-2">
                  {error || t("profileNotFound")}
                </h2>
                <p className="text-charcoal-400 mb-6">
                  {t("profileRemoved")}
                </p>
                <Link href="/recruiter/search">
                  <Button>{t("backToSearch")}</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-hidden">
          <Link
            href="/recruiter/search"
            className="inline-flex items-center text-charcoal-400 hover:text-charcoal-200 mb-6 transition-colors min-h-11"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t("backToSearchLink")}
          </Link>

          <div className="mb-6">
            <WorkerPublicProfileView
              profile={profile}
              mode="recruiter"
              headerBadge={
                interestOutcome ? (
                  <HireOutcomeStatusBadge status={interestOutcome.status} />
                ) : null
              }
              onUnlockContact={() => {
                void handleUnlock();
              }}
            />
          </div>

          <Card padding="lg">
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                {profile.contact.isLocked ? (
                  <>
                    <Button
                      variant="gold"
                      fullWidth
                      onClick={handleUnlock}
                    >
                      {t("unlockToExpress")}
                    </Button>
                    <Link href="/recruiter/search" className="flex-1">
                      <Button variant="outline" fullWidth>
                        {t("backToSearch")}
                      </Button>
                    </Link>
                  </>
                ) : interestOutcome ? (
                  <>
                    <div className="flex-1 flex flex-col sm:flex-row gap-3">
                      <HireOutcomeActions
                        interestId={interestOutcome.interestId}
                        currentStatus={interestOutcome.status}
                        confirmationRequest={interestOutcome.confirmationRequest}
                        onRequestCreated={handleRequestCreated}
                      />
                      <Link href="/recruiter/interests" className="flex-1">
                        <Button variant="outline" fullWidth>
                          {t("viewAllInterests")}
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-full space-y-3">
                      <OpeningInterestSelect
                        openings={publishedOpenings}
                        value={selectedOpeningId}
                        onChange={setSelectedOpeningId}
                      />
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          fullWidth
                          onClick={handleExpressInterest}
                          disabled={interestSent || interestLoading}
                          loading={interestLoading}
                        >
                          {interestSent ? t("interestSent") : t("imInterested")}
                        </Button>
                        <Link href="/recruiter/search" className="flex-1">
                          <Button variant="outline" fullWidth>
                            {t("backToSearch")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {interestSent && !interestOutcome && (
                <p className="text-center text-charcoal-400 text-sm mt-3">
                  {t("interestSentBody")}
                </p>
              )}
              {interestOutcome && (
                <div className="mt-4 pt-4 border-t border-charcoal-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-500">{t("hireStatus")}</span>
                    <HireOutcomeStatusBadge status={interestOutcome.status} />
                  </div>
                  {interestOutcome.hiredAt && (
                    <p className="text-charcoal-500 text-xs mt-2">
                      {t("hiredOn")} {new Date(interestOutcome.hiredAt).toLocaleDateString()}
                    </p>
                  )}
                  {interestOutcome.startedAt && (
                    <p className="text-charcoal-500 text-xs mt-1">
                      {t("startedOn")} {new Date(interestOutcome.startedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
