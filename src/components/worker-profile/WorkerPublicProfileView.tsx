"use client";

import React from "react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TopTalentBadge,
  Button,
} from "@/components/ui";
import { WorkerPhotoGallery } from "./WorkerPhotoGallery";
import { AvailabilityBadges } from "@/components/profile/AvailabilityBadges";
import type { PublicWorkerProfileView } from "@/lib/worker-profile/public-profile";

function LockIcon(): React.ReactElement {
  return (
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
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

function ContactItem({
  icon,
  label,
  value,
  isLocked,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  isLocked: boolean;
}): React.ReactElement | null {
  if (!value && !isLocked) return null;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="text-charcoal-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-charcoal-500">{label}</p>
        {isLocked ? (
          <p className="text-charcoal-600 flex items-center gap-1">
            <LockIcon />
            <span>Locked</span>
          </p>
        ) : value ? (
          <p className="text-charcoal-100 break-words">{value}</p>
        ) : null}
      </div>
    </div>
  );
}

interface WorkerPublicProfileViewProps {
  profile: PublicWorkerProfileView;
  mode?: "recruiter" | "preview";
  headerBadge?: React.ReactNode;
  onUnlockContact?: () => void;
}

export function WorkerPublicProfileView({
  profile,
  mode = "recruiter",
  headerBadge,
  onUnlockContact,
}: WorkerPublicProfileViewProps): React.ReactElement {
  const hasAnyContact =
    profile.contact.lineId ||
    profile.contact.whatsappNumber ||
    profile.contact.phoneNumber ||
    profile.contact.isLocked;

  return (
    <div className="space-y-6 min-w-0" data-testid="worker-public-profile">
      {mode === "preview" ? (
        <div className="rounded-lg border border-primary-500/30 bg-primary-500/10 px-4 py-3 text-sm text-primary-200">
          Recruiter preview — this is how recruiters see your public profile.
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
                  <Badge variant="success">Verified</Badge>
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
                  {profile.location || profile.area}
                </p>
              )}

              {profile.jobRoles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {profile.jobRoles.map((role) => (
                    <Badge key={role} variant="primary">
                      {role}
                    </Badge>
                  ))}
                </div>
              )}

              {profile.availability.length > 0 && (
                <div className="mt-2">
                  <p className="text-charcoal-500 text-sm mb-2">Availability</p>
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
            <CardTitle>About</CardTitle>
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
              <CardTitle>Experience</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.experienceYears !== null && (
                <p className="text-charcoal-300 mb-2">
                  <span className="text-charcoal-500">Years:</span>{" "}
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
              <CardTitle>Languages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.languages.map((lang) => (
                  <Badge key={lang}>{lang}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {(profile.expectedPayMin || profile.expectedPayMax) && (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Expected Pay</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-charcoal-300">
              {profile.expectedPayMin && profile.expectedPayMax ? (
                <>
                  {profile.payCurrency || "THB"}{" "}
                  {profile.expectedPayMin.toLocaleString()} -{" "}
                  {profile.expectedPayMax.toLocaleString()}
                </>
              ) : profile.expectedPayMin ? (
                <>
                  From {profile.payCurrency || "THB"}{" "}
                  {profile.expectedPayMin.toLocaleString()}
                </>
              ) : (
                <>
                  Up to {profile.payCurrency || "THB"}{" "}
                  {profile.expectedPayMax?.toLocaleString()}
                </>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {hasAnyContact && (
        <Card padding="lg">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Contact</CardTitle>
              {profile.contact.isLocked && profile.isTopTalent && (
                <Badge variant="gold">
                  <LockIcon />
                  <span className="ml-1">Top Talent</span>
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {profile.contact.isLocked ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gold-500/10 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-gold-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <p className="text-charcoal-300 mb-2">
                  Contact details are locked
                </p>
                <p className="text-charcoal-500 text-sm mb-4">
                  Subscribe to Top Talent to view LINE, WhatsApp, and phone
                  numbers for premium workers.
                </p>
                {onUnlockContact ? (
                  <Button variant="gold" onClick={onUnlockContact}>
                    Unlock Contact Details
                  </Button>
                ) : null}
              </div>
            ) : (
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
                  label="LINE ID"
                  value={profile.contact.lineId}
                  isLocked={false}
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
                  label="WhatsApp"
                  value={profile.contact.whatsappNumber}
                  isLocked={false}
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
                  label="Phone"
                  value={profile.contact.phoneNumber}
                  isLocked={false}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
