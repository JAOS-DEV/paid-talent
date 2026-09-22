import { resolveVenueName } from "@/lib/hire-outcomes/confirmations";
import { formatVenueAreaLabel } from "@/lib/interests/venue-label";

export interface WorkerInterestCardModel {
  interestId: string;
  venueName: string;
  areaLabel: string | null;
  blurb: string | null;
  logoUrl: string | null;
  openingRole: string | null;
}

export function toWorkerInterestCardModel(input: {
  interestId: string;
  venueName?: string | null;
  displayName?: string | null;
  area?: string | null;
  subArea?: string | null;
  blurb?: string | null;
  logoUrl?: string | null;
  openingRole?: string | null;
}): WorkerInterestCardModel {
  const blurb = input.blurb?.trim() ?? "";
  const openingRole = input.openingRole?.trim() ?? "";

  return {
    interestId: input.interestId,
    venueName: resolveVenueName(input.venueName, input.displayName),
    areaLabel: formatVenueAreaLabel(input.area, input.subArea),
    blurb: blurb.length > 0 ? blurb : null,
    logoUrl: input.logoUrl ?? null,
    openingRole: openingRole.length > 0 ? openingRole : null,
  };
}

export function workerInterestOpeningsPath(interestId: string): string {
  return `/worker/interests/${interestId}/openings`;
}

export function workerInterestVenuePath(interestId: string): string {
  return `/worker/interests/${interestId}/venue`;
}
