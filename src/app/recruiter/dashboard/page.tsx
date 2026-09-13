"use client";

import React, { Suspense } from "react";
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
  TopTalentBadge,
} from "@/components/ui";

function SubscriptionAlert(): React.ReactElement | null {
  const searchParams = useSearchParams();
  const subscriptionStatus = searchParams.get("subscription");

  if (subscriptionStatus === "success") {
    return (
      <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400">
        Successfully subscribed to Top Talent! You can now view full
        contact details.
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

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Your Interests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-primary-400 mb-2">0</div>
                <p className="text-charcoal-400 text-sm">
                  Workers you&apos;ve expressed interest in
                </p>
                <Link href="/recruiter/interests">
                  <Button variant="outline" fullWidth className="mt-4">
                    View All
                  </Button>
                </Link>
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
