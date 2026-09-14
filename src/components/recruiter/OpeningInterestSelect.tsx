"use client";

import React from "react";
import Link from "next/link";
import type { RecruiterOpening } from "@/lib/db/schema";

interface OpeningInterestSelectProps {
  openings: Pick<RecruiterOpening, "id" | "role" | "area" | "isPublished">[];
  value: string;
  onChange: (openingId: string) => void;
  id?: string;
}

/**
 * Optional opening selector for interest expression.
 * Only published openings should be passed in.
 */
export function OpeningInterestSelect({
  openings,
  value,
  onChange,
  id = "interest-opening",
}: OpeningInterestSelectProps): React.ReactElement {
  const published = openings.filter((o) => o.isPublished);

  return (
    <div className="w-full min-w-0">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-charcoal-200 mb-1.5"
      >
        Interested in hiring for
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 max-w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="">General interest</option>
        {published.map((opening) => (
          <option key={opening.id} value={opening.id}>
            {opening.role} — {opening.area}
          </option>
        ))}
      </select>
      {published.length === 0 && (
        <p className="mt-2 text-xs text-charcoal-500">
          No published openings yet.{" "}
          <Link
            href="/recruiter/openings/new"
            className="text-primary-400 hover:text-primary-300"
          >
            Create an opening
          </Link>
        </p>
      )}
    </div>
  );
}
