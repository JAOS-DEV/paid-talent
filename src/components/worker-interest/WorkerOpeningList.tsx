"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Card, CardContent } from "@/components/ui";
import type { OpeningTag } from "@/lib/interests/context";
import {
  AREA_MESSAGE_KEYS,
  JOB_ROLE_MESSAGE_KEYS,
  translateCatalogValue,
} from "@/lib/i18n/labels";
import {
  formatOpeningPay,
  localizedOpeningPeriod,
} from "@/lib/recruiter-profile/opening-pay";

interface WorkerOpeningListProps {
  openings: OpeningTag[];
}

function WorkerOpeningCard({
  opening,
}: {
  opening: OpeningTag;
}): React.ReactElement {
  const roles = useTranslations("roles");
  const areas = useTranslations("places.areas");
  const periods = useTranslations("payPeriods");
  const payLabel = formatOpeningPay(opening, (period) =>
    localizedOpeningPeriod(period, periods)
  );

  return (
    <Card padding="md" className="min-w-0">
      <CardContent>
        <h3 className="text-base font-semibold text-white break-words">
          {translateCatalogValue(roles, JOB_ROLE_MESSAGE_KEYS, opening.role)}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="default">
            {translateCatalogValue(areas, AREA_MESSAGE_KEYS, opening.area)}
          </Badge>
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
