"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import {
  getProfileCompleteness,
  INCOMPLETE_PROFILE_REDIRECT_THRESHOLD,
} from "@/lib/profile";
import type { WorkerProfile } from "@/lib/db/schema";

export default function WorkerDashboardPage(): React.ReactElement {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile(): Promise<void> {
      try {
        const res = await fetch("/api/worker/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);

          const completeness = getProfileCompleteness(data.profile);
          if (
            !completeness.isComplete &&
            completeness.progress < INCOMPLETE_PROFILE_REDIRECT_THRESHOLD
          ) {
            router.replace("/worker/onboarding");
            return;
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!session?.user?.id) {
      return;
    }

    if (session.user.role !== "worker") {
      router.replace("/auth/signin");
      return;
    }

    fetchProfile();
  }, [session, router]);

  if (status === "loading" || loading || !session || session.user.role !== "worker") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const completeness = getProfileCompleteness(profile);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-charcoal-100">
              Welcome, {session.user.name || profile?.displayName || "Worker"}!
            </h1>
            <p className="text-charcoal-400 mt-1">
              Manage your profile and see who&apos;s interested
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Your Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-charcoal-400 text-sm mb-4">
                  {completeness.isComplete
                    ? "Your profile is complete. Keep it updated!"
                    : "Complete your profile to get discovered by recruiters."}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-400">Profile status</span>
                    <span
                      className={
                        completeness.isComplete
                          ? "text-success"
                          : "text-yellow-400"
                      }
                    >
                      {completeness.isComplete
                        ? "Complete"
                        : `${completeness.progress}% complete`}
                    </span>
                  </div>
                  <div className="w-full bg-charcoal-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${completeness.isComplete ? "bg-success" : "bg-yellow-400"}`}
                      style={{ width: `${completeness.progress}%` }}
                    />
                  </div>
                </div>
                <Link
                  href={
                    completeness.isComplete
                      ? "/worker/profile"
                      : "/worker/onboarding"
                  }
                >
                  <Button fullWidth className="mt-4">
                    {completeness.isComplete
                      ? "Edit Profile"
                      : "Complete Profile"}
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Profile Views</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-primary-400 mb-2">0</div>
                <p className="text-charcoal-400 text-sm">
                  Views in the last 30 days
                </p>
                <div className="mt-4 text-sm text-charcoal-500">
                  {completeness.isComplete
                    ? "Share your profile to get more views"
                    : "Complete your profile to start getting views"}
                </div>
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Interest Received</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-primary-400 mb-2">0</div>
                <p className="text-charcoal-400 text-sm">
                  Recruiters interested in you
                </p>
                <div className="mt-4 text-sm text-charcoal-500">
                  You&apos;ll be notified when recruiters express interest
                </div>
              </CardContent>
            </Card>
          </div>

          {!completeness.isComplete && (
            <div className="mt-8">
              <Card padding="lg">
                <CardHeader>
                  <CardTitle>Quick Tips</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-start space-x-3">
                      <span className="w-6 h-6 rounded-full bg-primary-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-primary-400">1</span>
                      </span>
                      <span className="text-charcoal-300 text-sm">
                        Add a professional photo to increase profile views by up
                        to 40%
                      </span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="w-6 h-6 rounded-full bg-primary-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-primary-400">2</span>
                      </span>
                      <span className="text-charcoal-300 text-sm">
                        List your job roles and languages to appear in more
                        searches
                      </span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="w-6 h-6 rounded-full bg-primary-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-primary-400">3</span>
                      </span>
                      <span className="text-charcoal-300 text-sm">
                        Keep your availability updated to match recruiter needs
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
