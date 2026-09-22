"use client";

import React from "react";
import Link from "next/link";
import type { WorkerDashboardRecentInterest } from "@/lib/worker-dashboard";
import { WorkerInterestCard } from "./WorkerInterestCard";
import { toWorkerInterestCardModel } from "./model";

interface WorkerRecentInterestsProps {
  interests: WorkerDashboardRecentInterest[];
}

export function WorkerRecentInterests({
  interests,
}: WorkerRecentInterestsProps): React.ReactElement | null {
  if (interests.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 min-w-0" aria-labelledby="recent-interest-heading">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2
          id="recent-interest-heading"
          className="text-lg font-semibold text-white"
        >
          Recent interest
        </h2>
        <Link
          href="/worker/interests"
          className="inline-flex items-center min-h-11 text-sm text-primary-400 hover:text-primary-300"
        >
          View all interests
        </Link>
      </div>
      <ul className="space-y-4">
        {interests.map((interest) => (
          <li key={interest.id} className="min-w-0">
            <WorkerInterestCard
              interest={toWorkerInterestCardModel({
                interestId: interest.id,
                venueName: interest.venueName,
                area: interest.area,
                subArea: interest.subArea,
                blurb: interest.blurb,
                logoUrl: interest.logoUrl,
                openingRole: interest.openingRole,
              })}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
