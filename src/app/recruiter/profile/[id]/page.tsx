"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components/layout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  TopTalentBadge,
} from "@/components/ui";
import {
  HireOutcomeStatusBadge,
  HireOutcomeActions,
} from "@/components/hire-outcomes";
import { SendContactRequestDialog } from "@/components/contact-requests";
import { WorkerPublicProfileView } from "@/components/worker-profile";
import { AvailabilityBadges } from "@/components/profile/AvailabilityBadges";
import {
  JOB_ROLE_MESSAGE_KEYS,
  translateCatalogValue,
} from "@/lib/i18n/labels";
import type { WorkerProfileDetail } from "@/lib/recruiter-access/worker-dto";
import type { RecruiterAccessDto } from "@/lib/recruiter-access";
import type {
  HireConfirmationRequestStatus,
  HireConfirmationRequestedStatus,
  HireOutcomeStatus,
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

function verifyHref(access: RecruiterAccessDto | null): string {
  if (access && access.identityStatus === "verified" && !access.hasApprovedVenue) {
    return "/recruiter/venues";
  }
  return "/recruiter/verification";
}

function TeaserProfileView({
  profile,
  verifyCtaHref,
}: {
  profile: Extract<WorkerProfileDetail, { mode: "teaser" }>;
  verifyCtaHref: string;
}): React.ReactElement {
  const t = useTranslations("recruiter.workerDetail");
  const searchT = useTranslations("recruiter.search");
  const roleLabels = useTranslations("roles");
  const locked =
    profile.isTopTalent && profile.firstName == null;

  return (
    <Card padding="lg">
      <CardContent>
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-28 h-28 rounded-full overflow-hidden bg-charcoal-700">
            <img
              src={profile.teaserPhotoPath}
              alt=""
              className="w-full h-full object-cover scale-150"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            {locked ? (
              <>
                <svg
                  className="w-5 h-5 text-charcoal-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <TopTalentBadge />
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-charcoal-100">
                  {profile.firstName ?? searchT("teaserNameHidden")}
                </h1>
                {profile.isTopTalent ? <TopTalentBadge /> : null}
                <Badge variant="success">{searchT("verified")}</Badge>
              </>
            )}
          </div>

          {locked ? (
            <p className="text-charcoal-400 text-sm max-w-md">
              {searchT("lockedTopTalentHint")}
            </p>
          ) : (
            <>
              {profile.area ? (
                <p className="text-charcoal-400">{profile.area}</p>
              ) : null}
              {profile.jobRoles.length > 0 ? (
                <div className="flex flex-wrap gap-2 justify-center">
                  {profile.jobRoles.map((role) => (
                    <Badge key={role}>
                      {translateCatalogValue(
                        roleLabels,
                        JOB_ROLE_MESSAGE_KEYS,
                        role
                      )}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {profile.availability.length > 0 ? (
                <AvailabilityBadges values={profile.availability} />
              ) : null}
            </>
          )}

          <div className="pt-2 w-full max-w-sm">
            {locked ? (
              <Link href="/recruiter/upgrade">
                <Button fullWidth>{searchT("upgradeForTopTalent")}</Button>
              </Link>
            ) : (
              <Link href={verifyCtaHref}>
                <Button fullWidth>{t("verifyToSeeFull")}</Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfileDetailPage({
  params,
}: ProfilePageProps): React.ReactElement {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const t = useTranslations("recruiter.workerDetail");
  const [profile, setProfile] = useState<WorkerProfileDetail | null>(null);
  const [access, setAccess] = useState<RecruiterAccessDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interestSent, setInterestSent] = useState(false);
  const [contactRequestStatus, setContactRequestStatus] = useState<
    string | null
  >(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [interestOutcome, setInterestOutcome] =
    useState<InterestOutcomeData | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    const loadProfile = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const [accessRes, profileRes] = await Promise.all([
          fetch("/api/recruiter/access"),
          fetch(`/api/workers/${id}`),
        ]);

        if (cancelled) return;

        if (accessRes.ok) {
          setAccess((await accessRes.json()) as RecruiterAccessDto);
        }

        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile(data.profile);
          if (data.profile.mode === "full") {
            const cr = data.profile.contactRequest as
              | { id: string; status: string }
              | null
              | undefined;
            setInterestSent(Boolean(cr));
            setContactRequestStatus(cr?.status ?? null);

            if (cr?.status === "accepted") {
              setInterestOutcome({
                interestId: cr.id,
                status: data.profile.hireOutcomeStatus ?? "interested",
                hiredAt: data.profile.hiredAt ?? null,
                startedAt: data.profile.startedAt ?? null,
                confirmationRequest: data.profile.confirmationRequest ?? null,
              });
            } else {
              setInterestOutcome(null);
            }
          }
        } else if (profileRes.status === 404) {
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

  if (profile.mode === "teaser") {
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
            <TeaserProfileView
              profile={profile}
              verifyCtaHref={verifyHref(access)}
            />
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
            />
          </div>

          <Card padding="lg">
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                {interestOutcome ? (
                  <>
                    <div className="flex-1 flex flex-col sm:flex-row gap-3">
                      <HireOutcomeActions
                        interestId={interestOutcome.interestId}
                        currentStatus={interestOutcome.status}
                        confirmationRequest={interestOutcome.confirmationRequest}
                        onRequestCreated={handleRequestCreated}
                      />
                      <Link href="/recruiter/requests" className="flex-1">
                        <Button variant="outline" fullWidth>
                          {t("viewAllRequests")}
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-full space-y-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          fullWidth
                          onClick={() => setDialogOpen(true)}
                          disabled={interestSent}
                        >
                          {interestSent
                            ? t("requestSent")
                            : t("sendContactRequest")}
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
                  {contactRequestStatus === "queued"
                    ? t("requestQueuedBody")
                    : t("requestSentBody")}
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

      {profile?.mode === "full" ? (
        <SendContactRequestDialog
          open={dialogOpen}
          workerProfileId={profile.id}
          workerDisplayName={profile.displayName}
          isTopTalent={profile.isTopTalent}
          onClose={() => setDialogOpen(false)}
          onSent={() => {
            setInterestSent(true);
            setContactRequestStatus("pending");
            setDialogOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
