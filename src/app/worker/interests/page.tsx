import React from "react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui";
import {
  WorkerInterestCard,
  WorkerPageFrame,
  toWorkerInterestCardModel,
} from "@/components/worker-interest";
import { listWorkerInterestContexts } from "@/lib/interests";
import { toPublicVenueLogoUrl } from "@/lib/media/venue-logo";
import { requireWorkerUserId } from "./require-worker";

export default async function WorkerInterestsPage(): Promise<React.ReactElement> {
  const workerUserId = await requireWorkerUserId();
  const t = await getTranslations("worker.interests");
  const interests = await listWorkerInterestContexts(workerUserId);

  return (
    <WorkerPageFrame
      backHref="/worker/dashboard"
      backLabel={t("back")}
      title={t("title")}
    >
      {interests.length === 0 ? (
        <Card padding="lg">
          <CardContent>
            <p className="text-center text-charcoal-400 py-12" role="status">
              {t("empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {interests.map((interest) => (
            <li key={interest.interestId} className="min-w-0">
              <WorkerInterestCard
                interest={toWorkerInterestCardModel({
                  interestId: interest.interestId,
                  venueName: interest.recruiter.venueName,
                  displayName: interest.recruiter.displayName,
                  area: interest.recruiter.area,
                  subArea: interest.recruiter.subArea,
                  blurb: interest.recruiter.blurbSnippet,
                  logoUrl: toPublicVenueLogoUrl(interest.recruiter.logoUrl),
                  openingRole: interest.opening?.role ?? null,
                })}
              />
            </li>
          ))}
        </ul>
      )}
    </WorkerPageFrame>
  );
}
