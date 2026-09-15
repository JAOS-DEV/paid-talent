"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { WorkerDashboardRecentInterest } from "@/lib/worker-dashboard";

export default function WorkerInterestsPage(): React.ReactElement {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [interests, setInterests] = useState<WorkerDashboardRecentInterest[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const response = await fetch("/api/interests");
        if (!response.ok) return;
        const data = (await response.json()) as {
          interests?: Array<{
            id: string;
            venueName?: string;
            recruiterName?: string;
            openingContext?: string | null;
            message: string | null;
            createdAt: string;
          }>;
        };
        setInterests(
          (data.interests ?? []).map((interest) => ({
            id: interest.id,
            venueName: interest.venueName || interest.recruiterName || "A venue",
            openingContext: interest.openingContext ?? null,
            message: interest.message,
            createdAt: interest.createdAt,
          }))
        );
      } finally {
        setLoading(false);
      }
    }

    if (!session?.user?.id) return;
    if (session.user.role !== "worker") {
      router.replace("/auth/signin");
      return;
    }
    void load();
  }, [session, router]);

  if (status === "loading" || !session || session.user.role !== "worker") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/worker/dashboard"
            className="inline-flex items-center text-charcoal-400 hover:text-charcoal-200 mb-6 min-h-11"
          >
            Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold text-charcoal-100 mb-6">
            Interest received
          </h1>
          {loading ? (
            <div className="h-40 rounded-xl bg-charcoal-800 animate-pulse" />
          ) : interests.length === 0 ? (
            <Card padding="lg">
              <CardContent className="text-center py-12 text-charcoal-400">
                No recruiter interest yet.
              </CardContent>
            </Card>
          ) : (
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Recruiters interested in you</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {interests.map((interest) => (
                    <li
                      key={interest.id}
                      className="border-b border-charcoal-800 pb-4 last:border-0 last:pb-0"
                    >
                      <p className="text-charcoal-100 font-medium">
                        {interest.venueName}
                      </p>
                      <p className="text-charcoal-500 text-sm">
                        {new Date(interest.createdAt).toLocaleDateString()}
                        {interest.openingContext
                          ? ` · ${interest.openingContext}`
                          : ""}
                      </p>
                      {interest.message ? (
                        <p className="text-charcoal-400 text-sm mt-1 break-words">
                          {interest.message}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
