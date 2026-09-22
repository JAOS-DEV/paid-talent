"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, Card, CardContent } from "@/components/ui";
import { workerOutlineLinkClass, workerPrimaryLinkClass } from "./link-styles";
import {
  workerInterestOpeningsPath,
  workerInterestVenuePath,
  type WorkerInterestCardModel,
} from "./model";
import { VenueAvatar } from "./VenueAvatar";

export const WORKER_INTEREST_BADGE = "Interested in you";

interface WorkerInterestCardProps {
  interest: WorkerInterestCardModel;
}

export function WorkerInterestCard({
  interest,
}: WorkerInterestCardProps): React.ReactElement {
  const t = useTranslations("worker.interests");

  return (
    <article data-testid="worker-interest-card" className="min-w-0">
      <Card padding="md">
        <CardContent>
          <div className="flex items-start gap-3 min-w-0">
            <VenueAvatar
              venueName={interest.venueName}
              logoUrl={interest.logoUrl}
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-white break-words">
                {interest.venueName}
              </h2>
              {interest.areaLabel ? (
                <p className="text-sm text-charcoal-400 mt-0.5 break-words">
                  {interest.areaLabel}
                </p>
              ) : null}
            </div>
          </div>

          {interest.blurb ? (
            <p className="text-sm text-charcoal-400 mt-3 line-clamp-2 break-words">
              {interest.blurb}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="primary">{t("badge")}</Badge>
            {interest.openingRole ? (
              <Badge variant="default">{interest.openingRole}</Badge>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Link
              href={workerInterestOpeningsPath(interest.interestId)}
              className={workerPrimaryLinkClass}
            >
              {t("viewOpenings")}
            </Link>
            <Link
              href={workerInterestVenuePath(interest.interestId)}
              className={workerOutlineLinkClass}
            >
              {t("viewVenue")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}
