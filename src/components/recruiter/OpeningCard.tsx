"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
} from "@/components/ui";
import {
  deleteOpening,
  publishOpening,
  unpublishOpening,
} from "@/lib/recruiter-profile/actions";
import type { RecruiterOpening } from "@/lib/db/schema";
import { VenueLogo } from "@/components/media/VenueLogo";
import {
  JOB_ROLE_MESSAGE_KEYS,
  AREA_MESSAGE_KEYS,
  translateCatalogValue,
} from "@/lib/i18n/labels";
import { formatOpeningPay, localizedOpeningPeriod } from "./format-pay";

interface OpeningCardProps {
  opening: RecruiterOpening;
  venueLogoUrl?: string | null;
  venueName?: string | null;
}

function ChevronRightIcon(): React.ReactElement {
  return (
    <svg
      className="w-5 h-5 text-charcoal-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

export function OpeningCard({
  opening,
  venueLogoUrl = null,
  venueName = null,
}: OpeningCardProps): React.ReactElement {
  const router = useRouter();
  const t = useTranslations("recruiter.openings.card");
  const common = useTranslations("common");
  const roles = useTranslations("roles");
  const areas = useTranslations("places.areas");
  const periods = useTranslations("payPeriods");
  const [busy, setBusy] = useState<"publish" | "unpublish" | "delete" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const payLabel = formatOpeningPay(opening, (period) =>
    localizedOpeningPeriod(period, periods)
  );
  const roleLabel = translateCatalogValue(roles, JOB_ROLE_MESSAGE_KEYS, opening.role);
  const areaLabel = translateCatalogValue(areas, AREA_MESSAGE_KEYS, opening.area);

  const runPublishToggle = async (): Promise<void> => {
    setError(null);
    if (opening.isPublished) {
      setBusy("unpublish");
      const result = await unpublishOpening(opening.id);
      setBusy(null);
      if (!result.success) {
        setError(result.error || t("unpublishFailed"));
        return;
      }
    } else {
      setBusy("publish");
      const result = await publishOpening(opening.id);
      setBusy(null);
      if (!result.success) {
        setError(result.error || t("publishFailed"));
        return;
      }
    }
    router.refresh();
  };

  const runDelete = async (): Promise<void> => {
    setBusy("delete");
    setError(null);
    const result = await deleteOpening(opening.id);
    setBusy(null);
    if (!result.success) {
      setError(result.error || t("deleteFailed"));
      setConfirmDelete(false);
      return;
    }
    router.refresh();
  };

  return (
    <Card padding="none" className="min-w-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-charcoal-800/50 transition-colors rounded-xl"
      >
        <VenueLogo
          logoUrl={venueLogoUrl}
          name={venueName || opening.role}
          size="sm"
        />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-charcoal-100 break-words">
              {roleLabel}
            </h3>
            <Badge
              variant={opening.isPublished ? "success" : "warning"}
              className="text-xs"
            >
              {opening.isPublished ? t("published") : t("draft")}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" className="text-xs">
              {areaLabel}
            </Badge>
            {payLabel ? (
              <span className="text-lg font-bold text-primary-400">
                {payLabel}
              </span>
            ) : (
              <span className="text-sm text-charcoal-300">{t("noPay")}</span>
            )}
          </div>
          {opening.notes && (
            <p className="text-sm text-charcoal-500 line-clamp-2 break-words">
              {opening.notes}
            </p>
          )}
        </div>
        <div
          className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        >
          <ChevronRightIcon />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-charcoal-700 pt-3">
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Link href={`/recruiter/openings/${opening.id}/edit`}>
              <Button variant="outline" fullWidth>
                {t("edit")}
              </Button>
            </Link>
            <Button
              variant={opening.isPublished ? "secondary" : "primary"}
              fullWidth
              loading={busy === "publish" || busy === "unpublish"}
              onClick={() => void runPublishToggle()}
            >
              {opening.isPublished ? t("unpublish") : t("publish")}
            </Button>
            <Button
              variant="destructive"
              fullWidth
              disabled={busy !== null}
              onClick={() => setConfirmDelete(true)}
            >
              {t("delete")}
            </Button>
          </div>
        </div>
      )}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>
              {common("cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              fullWidth
              loading={busy === "delete"}
              onClick={() => void runDelete()}
            >
              {t("deleteOpening")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
