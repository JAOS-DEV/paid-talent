"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Card, CardContent } from "@/components/ui";
import type { OpeningTag } from "@/lib/interests/context";
import { formatOpeningPay } from "@/lib/recruiter-profile/opening-pay";

interface WorkerOpeningListProps {
  openings: OpeningTag[];
}

function WorkerOpeningCard({
  opening,
}: {
  opening: OpeningTag;
}): React.ReactElement {
  const payLabel = formatOpeningPay(opening);

  return (
    <Card padding="md" className="min-w-0">
      <CardContent>
        <h3 className="text-base font-semibold text-white break-words">
          {opening.role}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="default">{opening.area}</Badge>
          {payLabel ? (
            <p
              className="text-lg font-bold text-primary-400"
              data-testid="opening-pay"
            >
              {payLabel}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkerOpeningList({
  openings,
}: WorkerOpeningListProps): React.ReactElement {
  const t = useTranslations("worker.interests");

  if (openings.length === 0) {
    return (
      <Card padding="lg">
        <CardContent>
          <p className="text-center text-white py-8" role="status">
            {t("noOpenings")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {openings.map((opening) => (
        <li key={opening.openingId} className="min-w-0">
          <WorkerOpeningCard opening={opening} />
        </li>
      ))}
    </ul>
  );
}
