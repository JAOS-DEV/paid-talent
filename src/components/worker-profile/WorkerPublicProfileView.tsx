"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TopTalentBadge,
} from "@/components/ui";
import { WorkerPhotoGallery } from "./WorkerPhotoGallery";
import { AvailabilityBadges } from "@/components/profile/AvailabilityBadges";
import {
  AREA_MESSAGE_KEYS,
  CITY_MESSAGE_KEYS,
  JOB_ROLE_MESSAGE_KEYS,
  LANGUAGE_MESSAGE_KEYS,
  translateCatalogValue,
} from "@/lib/i18n/labels";
import type {
  OwnWorkerContact,
  PublicWorkerProfileView,
} from "@/lib/worker-profile/public-profile";
import { formatWorkerExpectedPay } from "@/lib/profile/expected-pay";

function ContactItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}): React.ReactElement | null {
  if (!value) return null;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="text-charcoal-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-charcoal-500">{label}</p>
        <p className="text-charcoal-100 break-words">{value}</p>
      </div>
    </div>
  );
}

interface WorkerPublicProfileViewProps {
  profile: PublicWorkerProfileView & { ownContact?: OwnWorkerContact };
  mode?: "recruiter" | "preview";
  headerBadge?: React.ReactNode;
}

export function WorkerPublicProfileView({
  profile,
  mode = "recruiter",
  headerBadge,
}: WorkerPublicProfileViewProps): React.ReactElement {
  const t = useTranslations("worker.publicProfile");
  const roleLabels = useTranslations("roles");
  const languageLabels = useTranslations("languages");
  const cityLabels = useTranslations("places.cities");
  const areaLabels = useTranslations("places.areas");
  const periods = useTranslations("payPeriods");
  const expectedPayLabel = formatWorkerExpectedPay(profile, {
    day: periods("slashDay"),
    month: periods("slashMonth"),
  });
  const placeLabel = profile.location
    ? translateCatalogValue(cityLabels, CITY_MESSAGE_KEYS, profile.location)
    : profile.area
      ? translateCatalogValue(areaLabels, AREA_MESSAGE_KEYS, profile.area)
      : null;
  const ownContact = mode === "preview" ? profile.ownContact : undefined;
  const hasOwnContactValues = Boolean(
    ownContact?.lineId || ownContact?.whatsappNumber || ownContact?.phoneNumber
  );

  return (
    <div className="space-y-6 min-w-0" data-testid="worker-public-profile">
      {mode === "preview" ? (
        <div className="rounded-lg border border-primary-500/30 bg-primary-500/10 px-4 py-3 text-sm text-primary-200">
          {t("previewBanner")}
        </div>
      ) : null}

      <Card padding="lg">
        <CardContent>
          <div className="flex flex-col gap-6 min-w-0">
            <WorkerPhotoGallery
              displayName={profile.displayName}
              photoUrl={profile.photoUrl}
              photos={profile.photos}
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-2xl font-bold text-charcoal-100">
                  {profile.displayName}
                </h1>
                {profile.isTopTalent && <TopTalentBadge />}
                {profile.isVerified && (
                  <Badge variant="success">{t("verified")}</Badge>
                )}
                {headerBadge}
              </div>

              {(profile.location || profile.area) && (
                <p className="text-charcoal-400 flex items-center gap-1 mb-3">
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {placeLabel}
                </p>
              )}

              {profile.jobRoles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {profile.jobRoles.map((role) => (
                    <Badge key={role} variant="primary">
                      {translateCatalogValue(roleLabels, JOB_ROLE_MESSAGE_KEYS, role)}
                    </Badge>
                  ))}
                </div>
              )}

              {profile.availability.length > 0 && (
                <div className="mt-2">
                  <p className="text-charcoal-500 text-sm mb-2">{t("availability")}</p>
                  <AvailabilityBadges values={profile.availability} />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {(profile.bio || profile.description) && (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>{t("about")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-charcoal-300 whitespace-pre-wrap">
              {profile.bio || profile.description}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        {(profile.experience || profile.experienceYears !== null) && (
          <Card padding="lg">
            <CardHeader>
              <CardTitle>{t("experience")}</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.experienceYears !== null && (
                <p className="text-charcoal-300 mb-2">
                  <span className="text-charcoal-500">{t("years")}</span>{" "}
                  {profile.experienceYears}+
                </p>
              )}
              {profile.experience && (
                <p className="text-charcoal-300 whitespace-pre-wrap">
                  {profile.experience}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {profile.languages.length > 0 && (
          <Card padding="lg">
            <CardHeader>
              <CardTitle>{t("languages")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.languages.map((lang) => (
                  <Badge key={lang}>
                    {translateCatalogValue(
                      languageLabels,
                      LANGUAGE_MESSAGE_KEYS,
                      lang
                    )}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {expectedPayLabel ? (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>{t("expectedPay")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-charcoal-300">{expectedPayLabel}</p>
          </CardContent>
        </Card>
      ) : null}

      {mode === "recruiter" ? (
        <div data-testid="contact-private-card">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>{t("contactPrivateTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-charcoal-400 text-sm">{t("contactPrivateBody")}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div data-testid="own-contact-card">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>{t("contact")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-charcoal-400 text-sm mb-4">{t("ownContactNote")}</p>
              {hasOwnContactValues && ownContact ? (
                <div className="divide-y divide-charcoal-700">
                  <ContactItem
                    icon={
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.67-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.49 1.02-.75 4.01-1.75 6.69-2.9 8.03-3.46 3.82-1.6 4.62-1.88 5.14-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.01.06.01.24 0 .38z" />
                      </svg>
                    }
                    label={t("lineId")}
                    value={ownContact.lineId}
                  />
                  <ContactItem
                    icon={
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    }
                    label={t("whatsapp")}
                    value={ownContact.whatsappNumber}
                  />
                  <ContactItem
                    icon={
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    }
                    label={t("phone")}
                    value={ownContact.phoneNumber}
                  />
                </div>
              ) : (
                <p className="text-charcoal-500 text-sm">{t("ownContactEmpty")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
