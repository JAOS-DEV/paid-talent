"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import {
  Button,
  Card,
  CardContent,
  Input,
  Badge,
  TopTalentBadge,
} from "@/components/ui";
import { AdSense } from "@/components/ads";

interface WorkerCardProps {
  isTopTalent: boolean;
  hasAccess: boolean;
}

function WorkerCard({ isTopTalent, hasAccess }: WorkerCardProps): React.ReactElement {
  return (
    <Card hover padding="lg">
      <CardContent>
        <div className="flex items-start space-x-4">
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

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-charcoal-100 truncate">
                Sample Worker
              </h3>
              {isTopTalent && <TopTalentBadge />}
            </div>

            <p className="text-charcoal-400 text-sm mb-2">Bangkok, Thailand</p>

            <div className="flex flex-wrap gap-2 mb-3">
              <Badge>Bartender</Badge>
              <Badge>Server</Badge>
            </div>

            <p className="text-charcoal-500 text-sm">Available: Weekends</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-charcoal-700">
          {isTopTalent && !hasAccess ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center text-charcoal-500 text-sm">
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
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Contact locked
              </div>
              <Button variant="gold" size="sm">
                Unlock Contact
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm">
                View Profile
              </Button>
              <Button size="sm">Express Interest</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SearchPage(): React.ReactElement {
  const { data: session, status } = useSession();
  const [searchQuery, setSearchQuery] = useState("");

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

  const hasTopTalentAccess = false;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-charcoal-100">
              Search Workers
            </h1>
            <p className="text-charcoal-400 mt-1">
              Find the perfect talent for your needs
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <Card padding="lg">
                <CardContent className="space-y-4">
                  <h3 className="font-semibold text-charcoal-100">Filters</h3>

                  <Input
                    label="Search"
                    placeholder="Name or keyword"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  <div>
                    <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                      Job Role
                    </label>
                    <select className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="">All roles</option>
                      <option value="bartender">Bartender</option>
                      <option value="server">Server</option>
                      <option value="host">Host</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                      Area
                    </label>
                    <select className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="">All areas</option>
                      <option value="bangkok">Bangkok</option>
                      <option value="pattaya">Pattaya</option>
                      <option value="phuket">Phuket</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                      Availability
                    </label>
                    <select className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="">Any availability</option>
                      <option value="fulltime">Full-time</option>
                      <option value="parttime">Part-time</option>
                      <option value="weekends">Weekends</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="verified-only"
                      className="w-4 h-4 rounded border-charcoal-600 bg-charcoal-800 text-primary-600 focus:ring-primary-500"
                    />
                    <label
                      htmlFor="verified-only"
                      className="text-sm text-charcoal-300"
                    >
                      Verified only
                    </label>
                  </div>

                  <Button fullWidth>Apply Filters</Button>
                </CardContent>
              </Card>

              <div className="mt-6">
                <AdSense adSlot="search-sidebar" adFormat="vertical" />
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-charcoal-400 text-sm">
                  Showing placeholder results
                </p>
                <select className="px-3 py-1.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>Most relevant</option>
                  <option>Most viewed</option>
                  <option>Newest</option>
                </select>
              </div>

              <div className="space-y-4">
                <WorkerCard isTopTalent={true} hasAccess={hasTopTalentAccess} />
                <WorkerCard isTopTalent={false} hasAccess={hasTopTalentAccess} />
                <WorkerCard isTopTalent={true} hasAccess={hasTopTalentAccess} />
                <WorkerCard isTopTalent={false} hasAccess={hasTopTalentAccess} />
              </div>

              <div className="text-center py-12 text-charcoal-500">
                <p>More workers will appear as profiles are created</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
