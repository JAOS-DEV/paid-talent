"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, redirect } from "next/navigation";
import Link from "next/link";
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
import type { SearchWorkerResult } from "@/app/api/workers/search/route";

interface WorkerCardProps {
  worker: SearchWorkerResult;
  hasTopTalentAccess: boolean;
  interestSent: boolean;
  onUnlock: () => void;
  onExpressInterest: () => void;
}

function WorkerCard({
  worker,
  hasTopTalentAccess,
  interestSent,
  onUnlock,
  onExpressInterest,
}: WorkerCardProps): React.ReactElement {
  const isLocked = worker.isTopTalent && !hasTopTalentAccess;

  return (
    <Card hover padding="lg">
      <CardContent>
        <div className="flex items-start space-x-4">
          {worker.photoUrl ? (
            <img
              src={worker.photoUrl}
              alt={worker.displayName}
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

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-lg font-semibold text-charcoal-100 truncate">
                {worker.displayName}
              </h3>
              {worker.isTopTalent && <TopTalentBadge />}
              {worker.isVerified && (
                <Badge variant="success">Verified</Badge>
              )}
            </div>

            {(worker.location || worker.area) && (
              <p className="text-charcoal-400 text-sm mb-2">
                {worker.location || worker.area}
              </p>
            )}

            {worker.jobRoles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {worker.jobRoles.slice(0, 3).map((role) => (
                  <Badge key={role}>{role}</Badge>
                ))}
                {worker.jobRoles.length > 3 && (
                  <Badge variant="default">+{worker.jobRoles.length - 3}</Badge>
                )}
              </div>
            )}

            {worker.availability && (
              <p className="text-charcoal-500 text-sm">
                Available: {worker.availability}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-charcoal-700">
          {isLocked ? (
            <div className="flex items-center justify-between flex-wrap gap-2">
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
              <Button variant="gold" size="sm" onClick={onUnlock}>
                Unlock Contact
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Link href={`/recruiter/profile/${worker.id}`}>
                <Button variant="outline" size="sm">
                  View Profile
                </Button>
              </Link>
              {interestSent ? (
                <Button size="sm" variant="secondary" disabled>
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Interest Sent
                </Button>
              ) : (
                <Button size="sm" onClick={onExpressInterest}>
                  Express Interest
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SearchFilters {
  query: string;
  role: string;
  area: string;
  availability: string;
}

export default function SearchPage(): React.ReactElement {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    role: "",
    area: "",
    availability: "",
  });
  const [workers, setWorkers] = useState<SearchWorkerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [hasTopTalentAccess, setHasTopTalentAccess] = useState(false);
  const [sentInterests, setSentInterests] = useState<Set<string>>(new Set());

  const fetchWorkers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.query) params.set("query", filters.query);
      if (filters.role) params.set("role", filters.role);
      if (filters.area) params.set("area", filters.area);
      if (filters.availability) params.set("availability", filters.availability);

      const response = await fetch(`/api/workers/search?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setWorkers(data.workers);
        setTotal(data.pagination?.total ?? data.total ?? 0);
      }
    } catch (error) {
      console.error("Failed to fetch workers:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchInterests = useCallback(async () => {
    try {
      const response = await fetch("/api/interests");
      if (response.ok) {
        const data = await response.json();
        const interestProfileIds = new Set<string>(
          data.interests?.map((i: { workerProfileId: string }) => i.workerProfileId) || []
        );
        setSentInterests(interestProfileIds);
      }
    } catch {
      setSentInterests(new Set());
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    try {
      const response = await fetch("/api/stripe/status");
      if (response.ok) {
        const data = await response.json();
        setHasTopTalentAccess(data.canAccessTopTalent ?? false);
      }
    } catch {
      setHasTopTalentAccess(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      const loadData = async (): Promise<void> => {
        await Promise.all([fetchWorkers(), checkSubscription(), fetchInterests()]);
      };
      void loadData();
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplyFilters = (): void => {
    fetchWorkers();
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
    } catch (error) {
      console.error("Failed to start checkout:", error);
    }
  };

  const handleExpressInterest = async (workerProfileId: string): Promise<void> => {
    try {
      const response = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerProfileId }),
      });
      if (response.ok) {
        setSentInterests((prev) => new Set([...prev, workerProfileId]));
      }
    } catch (error) {
      console.error("Failed to express interest:", error);
    }
  };

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
                    value={filters.query}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, query: e.target.value }))
                    }
                  />

                  <div>
                    <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                      Job Role
                    </label>
                    <select
                      value={filters.role}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, role: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">All roles</option>
                      <option value="Bartender">Bartender</option>
                      <option value="Server">Server</option>
                      <option value="Host/Hostess">Host/Hostess</option>
                      <option value="Chef">Chef</option>
                      <option value="Barista">Barista</option>
                      <option value="Manager">Manager</option>
                      <option value="DJ">DJ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                      Area
                    </label>
                    <select
                      value={filters.area}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, area: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">All areas</option>
                      <option value="Bangkok">Bangkok</option>
                      <option value="Pattaya">Pattaya</option>
                      <option value="Phuket">Phuket</option>
                      <option value="Chiang Mai">Chiang Mai</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                      Availability
                    </label>
                    <select
                      value={filters.availability}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          availability: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Any availability</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Weekends">Weekends</option>
                      <option value="Flexible">Flexible</option>
                    </select>
                  </div>

                  <Button fullWidth onClick={handleApplyFilters}>
                    Apply Filters
                  </Button>
                </CardContent>
              </Card>

              <div className="mt-6">
                <AdSense adSlot="search-sidebar" adFormat="vertical" />
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-charcoal-400 text-sm">
                  {loading
                    ? "Searching..."
                    : total > 0
                      ? `${total} verified worker${total !== 1 ? "s" : ""} found`
                      : "No verified workers found"}
                </p>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
              ) : workers.length > 0 ? (
                <div className="space-y-4">
                  {workers.map((worker) => (
                    <WorkerCard
                      key={worker.id}
                      worker={worker}
                      hasTopTalentAccess={hasTopTalentAccess}
                      interestSent={sentInterests.has(worker.id)}
                      onUnlock={handleUnlock}
                      onExpressInterest={() => handleExpressInterest(worker.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-charcoal-500">
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
                  <p>No verified workers found matching your criteria</p>
                  <p className="text-sm mt-2">
                    Try adjusting your filters or check back later
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
