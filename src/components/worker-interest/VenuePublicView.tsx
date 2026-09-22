import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui";
import { workerPrimaryLinkClass } from "./link-styles";
import { workerInterestOpeningsPath } from "./model";
import { VenueAvatar } from "./VenueAvatar";

interface VenuePublicViewProps {
  interestId: string;
  venueName: string;
  areaLabel: string | null;
  blurb: string | null;
  logoUrl: string | null;
}

export function VenuePublicView({
  interestId,
  venueName,
  areaLabel,
  blurb,
  logoUrl,
}: VenuePublicViewProps): React.ReactElement {
  return (
    <Card padding="lg">
      <CardContent>
        <div className="flex items-start gap-4 min-w-0">
          <VenueAvatar venueName={venueName} logoUrl={logoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-white break-words">
              {venueName}
            </h2>
            {areaLabel ? (
              <p className="text-sm text-charcoal-400 mt-1 break-words">
                {areaLabel}
              </p>
            ) : null}
          </div>
        </div>
        {blurb ? (
          <p className="text-charcoal-200 mt-4 whitespace-pre-wrap break-words">
            {blurb}
          </p>
        ) : null}
        <div className="mt-6">
          <Link
            href={workerInterestOpeningsPath(interestId)}
            className={workerPrimaryLinkClass}
          >
            View openings
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
