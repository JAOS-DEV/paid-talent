import React from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  VenuePublicView,
  VenueUnavailable,
  WorkerPageFrame,
} from "@/components/worker-interest";
import { loadWorkerVenueView } from "@/lib/interests";
import { requireWorkerUserId } from "../../require-worker";

interface WorkerVenuePageProps {
  params: Promise<{ interestId: string }>;
}

export default async function WorkerVenuePage({
  params,
}: WorkerVenuePageProps): Promise<React.ReactElement> {
  const workerUserId = await requireWorkerUserId();
  const { interestId } = await params;
  const t = await getTranslations("worker.interests");
  const view = await loadWorkerVenueView(interestId, workerUserId);

  if (view.status === "missing") {
    notFound();
  }

  return (
    <WorkerPageFrame
      backHref="/worker/interests"
      backLabel={t("backToInterests")}
      title={view.status === "ready" ? view.venueName : t("venueFallback")}
    >
      {view.status === "unavailable" ? (
        <VenueUnavailable />
      ) : (
        <VenuePublicView
          interestId={view.interestId}
          venueName={view.venueName}
          areaLabel={view.areaLabel}
          blurb={view.blurb}
          logoUrl={view.logoUrl}
        />
      )}
    </WorkerPageFrame>
  );
}
