"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { redirect } from "next/navigation";
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
import type {
  HireConfirmationRequestStatus,
  HireConfirmationRequestedStatus,
  HireOutcomeStatus,
} from "@/lib/db/schema";

type FilterTab = "all" | HireOutcomeStatus;

interface InterestWithOutcome {
  id: string;
  workerProfileId: string;
  workerName: string;
  workerPhoto: string | null;
  message: string | null;
  createdAt: string;
  hireOutcome: {
    id: string;
    status: HireOutcomeStatus;
    hiredAt: string | null;
    startedAt: string | null;
    notes: string | null;
  } | null;
  confirmationRequest: {
    id: string;
    requestedStatus: HireConfirmationRequestedStatus;
    requestStatus: HireConfirmationRequestStatus;
    requestedAt: string;
  } | null;
}

interface OutcomeStats {
  total: number;
  interested: number;
  hired: number;
  started: number;
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "interested", label: "Interested" },
  { key: "hired", label: "Hired" },
  { key: "started", label: "Started" },
];

function getEffectiveStatus(
  interest: InterestWithOutcome
): HireOutcomeStatus {
  return interest.hireOutcome?.status ?? "interested";
}

function InterestCard({
  interest,
  onRequestCreated,
}: {
  interest: InterestWithOutcome;
  onRequestCreated: (
    interestId: string,
    requestedStatus: HireConfirmationRequestedStatus
  ) => void;
}): React.ReactElement {
  const effectiveStatus = getEffectiveStatus(interest);
  const createdDate = new Date(interest.createdAt).toLocaleDateString();

  const handleRequestCreated = useCallback(
    (requestedStatus: HireConfirmationRequestedStatus) => {
      onRequestCreated(interest.id, requestedStatus);
    },
    [interest.id, onRequestCreated]
  );

  return (
    <div data-testid="interest-card" data-worker-name={interest.workerName}>
    <Card padding="md" className="hover:border-charcoal-600 transition-colors">
      <CardContent>
        <div className="flex items-start gap-4">
          <Link href={`/recruiter/profile/${interest.workerProfileId}`}>
            {interest.workerPhoto ? (
              <img
                src={interest.workerPhoto}
                alt={interest.workerName}
                className="w-16 h-16 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-charcoal-700 flex-shrink-0 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-charcoal-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href={`/recruiter/profile/${interest.workerProfileId}`}
                className="text-charcoal-100 font-medium hover:text-primary-400 truncate"
              >
                {interest.workerName}
              </Link>
              <HireOutcomeStatusBadge status={effectiveStatus} />
            </div>

            <p className="text-charcoal-500 text-sm mb-2">
              Interested on {createdDate}
            </p>

            {interest.message && (
              <p className="text-charcoal-400 text-sm line-clamp-2 mb-3">
                {interest.message}
              </p>
            )}

            {interest.hireOutcome?.hiredAt && (
              <p className="text-charcoal-500 text-xs">
                Hired:{" "}
                {new Date(interest.hireOutcome.hiredAt).toLocaleDateString()}
              </p>
            )}
            {interest.hireOutcome?.startedAt && (
              <p className="text-charcoal-500 text-xs">
                Started:{" "}
                {new Date(interest.hireOutcome.startedAt).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <HireOutcomeActions
              interestId={interest.id}
              currentStatus={effectiveStatus}
              confirmationRequest={interest.confirmationRequest}
              onRequestCreated={handleRequestCreated}
              compact
            />
            <Link href={`/recruiter/profile/${interest.workerProfileId}`}>
              <Button variant="outline" size="sm">
                View Profile
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

function StatsBar({ stats }: { stats: OutcomeStats }): React.ReactElement {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div className="bg-charcoal-800 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-charcoal-100">{stats.total}</div>
        <div className="text-charcoal-500 text-sm">Total</div>
      </div>
      <div className="bg-charcoal-800 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-primary-400">{stats.interested}</div>
        <div className="text-charcoal-500 text-sm">Interested</div>
      </div>
      <div className="bg-charcoal-800 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-gold-400">{stats.hired}</div>
        <div className="text-charcoal-500 text-sm">Hired</div>
      </div>
      <div className="bg-charcoal-800 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-green-400">{stats.started}</div>
        <div className="text-charcoal-500 text-sm">Started</div>
      </div>
    </div>
  );
}

function RecruiterInterestsContent(): React.ReactElement {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [interests, setInterests] = useState<InterestWithOutcome[]>([]);
  const [stats, setStats] = useState<OutcomeStats>({
    total: 0,
    interested: 0,
    hired: 0,
    started: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeFilter = (searchParams.get("filter") as FilterTab) || "all";

  const setFilter = useCallback(
    (filter: FilterTab) => {
      const params = new URLSearchParams(searchParams);
      if (filter === "all") {
        params.delete("filter");
      } else {
        params.set("filter", filter);
      }
      router.push(`/recruiter/interests?${params.toString()}`);
    },
    [router, searchParams]
  );

  const loadInterests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filterParam = activeFilter === "all" ? "" : `?filter=${activeFilter}`;
      const [interestsRes, statsRes] = await Promise.all([
        fetch(`/api/recruiter/interests${filterParam}`),
        fetch("/api/recruiter/interests/stats"),
      ]);

      if (interestsRes.ok) {
        const data = await interestsRes.json();
        setInterests(data.interests);
      } else {
        setError("Failed to load interests");
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    if (status === "authenticated") {
      void loadInterests();
    }
  }, [status, loadInterests]);

  const handleRequestCreated = useCallback(
    (interestId: string, requestedStatus: HireConfirmationRequestedStatus) => {
      setInterests((prev) =>
        prev.map((interest) => {
          if (interest.id !== interestId) return interest;
          return {
            ...interest,
            confirmationRequest: {
              id: interest.confirmationRequest?.id ?? `pending-${interestId}`,
              requestedStatus,
              requestStatus: "pending",
              requestedAt: new Date().toISOString(),
            },
          };
        })
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link
              href="/recruiter/dashboard"
              className="inline-flex items-center text-charcoal-400 hover:text-charcoal-200 mb-4 transition-colors"
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
              Back to Dashboard
            </Link>

            <h1 className="text-2xl font-bold text-charcoal-100">
              Your Interests
            </h1>
            <p className="text-charcoal-400 mt-1">
              Manage workers you&apos;ve expressed interest in
            </p>
          </div>

          <StatsBar stats={stats} />

          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeFilter === tab.key
                    ? "bg-primary-600 text-white"
                    : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
                }`}
              >
                {tab.label}
                {tab.key !== "all" && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({tab.key === "interested"
                      ? stats.interested
                      : tab.key === "hired"
                      ? stats.hired
                      : stats.started})
                  </span>
                )}
              </button>
            ))}
          </div>

          {error ? (
            <Card padding="lg">
              <CardContent className="text-center py-8">
                <p className="text-red-400 mb-4">{error}</p>
                <Button onClick={() => void loadInterests()}>Retry</Button>
              </CardContent>
            </Card>
          ) : interests.length === 0 ? (
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <h2 className="text-xl font-semibold text-charcoal-100 mb-2">
                  {activeFilter === "all"
                    ? "No interests yet"
                    : `No ${activeFilter} workers`}
                </h2>
                <p className="text-charcoal-400 mb-6">
                  {activeFilter === "all"
                    ? "Start by searching for workers and expressing interest."
                    : `No workers have a confirmed ${activeFilter} status yet.`}
                </p>
                <Link href="/recruiter/search">
                  <Button>Search Workers</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {interests.map((interest) => (
                <InterestCard
                  key={interest.id}
                  interest={interest}
                  onRequestCreated={handleRequestCreated}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function LoadingFallback(): React.ReactElement {
  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
      <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );
}

export default function RecruiterInterestsPage(): React.ReactElement {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RecruiterInterestsContent />
    </Suspense>
  );
}
