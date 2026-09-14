"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  TopTalentBadge,
} from "@/components/ui";
import {
  getRecruiterProfile,
  getRecruiterOpenings,
} from "@/lib/recruiter-profile/actions";
import {
  getRecruiterProfileCompleteness,
} from "@/lib/recruiter-profile";

interface OutcomeStats {
  total: number;
  interested: number;
  hired: number;
  started: number;
}

function SubscriptionAlert(): React.ReactElement | null {
  const searchParams = useSearchParams();
  const subscriptionStatus = searchParams.get("subscription");

  if (subscriptionStatus === "success") {
    return (
      <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400">
        Successfully subscribed to Top Talent! You can now view full contact
        details.
      </div>
    );
  }

  if (subscriptionStatus === "cancelled") {
    return (
      <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
        Subscription was not completed. You can try again when ready.
      </div>
    );
  }

  return null;
}

function InterestsCard(): React.ReactElement {
  const [stats, setStats] = useState<OutcomeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async (): Promise<void> => {
      try {
        const response = await fetch("/api/recruiter/interests/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data.stats);
        }
      } catch {
        // Silently fail, show 0 counts
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, []);

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Your Interests</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="animate-pulse">
            <div className="h-10 bg-charcoal-700 rounded w-16 mb-2" />
            <div className="h-4 bg-charcoal-700 rounded w-32" />
          </div>
        ) : (
          <>
            <div className="text-4xl font-bold text-primary-400 mb-2">
              {stats?.total ?? 0}
            </div>
            <p className="text-charcoal-400 text-sm mb-3">
              Workers you&apos;ve expressed interest in
            </p>
            {stats && stats.total > 0 && (
              <div className="flex gap-4 text-xs text-charcoal-500 mb-4">
                <span>
                  <span className="text-primary-400 font-medium">
                    {stats.interested}
                  </span>{" "}
                  Interested
                </span>
                <span>
                  <span className="text-gold-400 font-medium">
                    {stats.hired}
                  </span>{" "}
                  Hired
                </span>
                <span>
                  <span className="text-green-400 font-medium">
                    {stats.started}
                  </span>{" "}
                  Started
                </span>
              </div>
            )}
          </>
        )}
        <Link href="/recruiter/interests">
          <Button variant="outline" fullWidth className="mt-2">
            View All
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function VenueStatusCard(): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const [profile, openings] = await Promise.all([
          getRecruiterProfile(),
          getRecruiterOpenings(),
        ]);
        setComplete(getRecruiterProfileCompleteness(profile).isComplete);
        setPublishedCount(openings.filter((o) => o.isPublished).length);
        setDraftCount(openings.filter((o) => !o.isPublished).length);
      } catch {
        // leave defaults
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <Card padding="lg">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Venue Profile</CardTitle>
          {!loading && (
            <Badge variant={complete ? "success" : "warning"}>
              {complete ? "Venue profile complete" : "Venue profile incomplete"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-charcoal-400 text-sm mb-4">
          Update the venue details workers see when you express interest.
        </p>
        {!loading && (
          <p className="text-xs text-charcoal-500 mb-4">
            Openings: {publishedCount} published · {draftCount} draft
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/recruiter/profile" className="flex-1">
            <Button fullWidth variant="outline">
              Venue Profile
            </Button>
          </Link>
          <Link href="/recruiter/openings" className="flex-1">
            <Button fullWidth>
              Openings
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RecruiterDashboardPage(): React.ReactElement {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session || session.user.role !== "recruiter") {
    redirect("/auth/signin");
  }

  const hasTopTalent = false;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Suspense fallback={null}>
            <SubscriptionAlert />
          </Suspense>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-charcoal-100">
              Welcome, {session.user.name || "Recruiter"}!
            </h1>
            <p className="text-charcoal-400 mt-1">
              Find and connect with talented workers
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Search Workers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-charcoal-400 text-sm mb-4">
                  Browse our database of skilled workers. Filter by role, area,
                  availability, and more.
                </p>
                <Link href="/recruiter/search">
                  <Button fullWidth>Start Searching</Button>
                </Link>
              </CardContent>
            </Card>

            <VenueStatusCard />

            <InterestsCard />

            <Card padding="lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Top Talent Access</CardTitle>
                  <TopTalentBadge />
                </div>
              </CardHeader>
              <CardContent>
                {hasTopTalent ? (
                  <>
                    <p className="text-charcoal-400 text-sm mb-4">
                      You have access to full contact details for Top Talent
                      workers.
                    </p>
                    <Button variant="outline" fullWidth>
                      Manage Subscription
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-charcoal-400 text-sm mb-4">
                      Unlock full contact details including LINE, WhatsApp, and
                      phone numbers.
                    </p>
                    <Button variant="gold" fullWidth>
                      Subscribe Now
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Recent Top Talent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-charcoal-500">
                  <svg
                    className="w-12 h-12 mx-auto mb-4 opacity-50"
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
                  <p>No top talent profiles yet</p>
                  <Link
                    href="/recruiter/search"
                    className="text-primary-400 hover:text-primary-300 text-sm mt-2 inline-block"
                  >
                    Search for workers
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
