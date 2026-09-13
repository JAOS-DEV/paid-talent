"use client";

import React from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default function WorkerDashboardPage(): React.ReactElement {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session || session.user.role !== "worker") {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-charcoal-100">
              Welcome, {session.user.name || "Worker"}!
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
                  Complete your profile to get discovered by recruiters.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-400">Profile status</span>
                    <span className="text-yellow-400">Incomplete</span>
                  </div>
                  <div className="w-full bg-charcoal-700 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full"
                      style={{ width: "30%" }}
                    />
                  </div>
                </div>
                <Link href="/worker/profile">
                  <Button fullWidth className="mt-4">
                    Edit Profile
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
                  Complete your profile to start getting views
                </div>
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Interest Received</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gold-400 mb-2">0</div>
                <p className="text-charcoal-400 text-sm">
                  Recruiters interested in you
                </p>
                <div className="mt-4 text-sm text-charcoal-500">
                  You&apos;ll be notified when recruiters express interest
                </div>
              </CardContent>
            </Card>
          </div>

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
        </div>
      </main>

      <Footer />
    </div>
  );
}
