"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RecruiterOpening } from "@/lib/db/schema";
import { formatOpeningChoiceLabel } from "@/lib/recruiter-profile/opening-pay";

type OpeningInterestChoice = Pick<
  RecruiterOpening,
  | "id"
  | "role"
  | "area"
  | "isPublished"
  | "payMin"
  | "payMax"
  | "payCurrency"
  | "payPeriod"
>;

interface OpeningInterestSelectProps {
  openings: OpeningInterestChoice[];
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
  const t = useTranslations("recruiter.openings");
  const published = openings.filter((o) => o.isPublished);

  return (
    <div className="w-full min-w-0">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-charcoal-200 mb-1.5"
      >
        {t("hiringFor")}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 max-w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="">{t("generalInterest")}</option>
        {published.map((opening) => (
          <option key={opening.id} value={opening.id}>
            {formatOpeningChoiceLabel(opening)}
          </option>
        ))}
      </select>
      {published.length === 0 && (
        <p className="mt-2 text-xs text-charcoal-500">
          {t("noPublished")}{" "}
          <Link
            href="/recruiter/openings/new"
            className="text-primary-400 hover:text-primary-300"
          >
            {t("createOpening")}
          </Link>
        </p>
      )}
    </div>
  );
}
