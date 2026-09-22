import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  VenueUnavailable,
  WorkerOpeningList,
  WorkerPageFrame,
  workerInterestVenuePath,
} from "@/components/worker-interest";
import { workerOutlineLinkClass } from "@/components/worker-interest/link-styles";
import { loadWorkerVenueView } from "@/lib/interests";
import { requireWorkerUserId } from "../../require-worker";

interface WorkerOpeningsPageProps {
  params: Promise<{ interestId: string }>;
}

export default async function WorkerOpeningsPage({
  params,
}: WorkerOpeningsPageProps): Promise<React.ReactElement> {
  const workerUserId = await requireWorkerUserId();
  const { interestId } = await params;
  const t = await getTranslations("worker.interests");
  const view = await loadWorkerVenueView(interestId, workerUserId);

  if (view.status === "missing") {
    notFound();
  }

  const title =
    view.status === "ready"
      ? t("openingsTitle", { venue: view.venueName })
      : t("openingsFallback");

  return (
    <WorkerPageFrame
      backHref="/worker/interests"
      backLabel={t("backToInterests")}
      title={title}
    >
      {view.status === "unavailable" ? (
        <VenueUnavailable />
      ) : (
        <div className="space-y-4">
          <Link
            href={workerInterestVenuePath(view.interestId)}
            className={workerOutlineLinkClass}
          >
            {t("viewVenue")}
          </Link>
          <WorkerOpeningList openings={view.openings} />
        </div>
      )}
    </WorkerPageFrame>
  );
}
