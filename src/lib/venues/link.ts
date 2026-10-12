import type { VenueLinkKind } from "@/lib/db/schema";

export type ParseVenueLinkSuccess = {
  ok: true;
  kind: VenueLinkKind;
  normalizedUrl: string;
};

export type ParseVenueLinkFailure = {
  ok: false;
  error: string;
};

export type ParseVenueLinkResult = ParseVenueLinkSuccess | ParseVenueLinkFailure;

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAM_NAMES = new Set(["fbclid", "igshid"]);

function hostnameWithoutWww(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function isGoogleMapsHost(host: string): boolean {
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") return true;
  if (host === "google.com") return true;
  if (host.endsWith(".google.com")) return true;
  if (host === "maps.google.com") return true;
  if (/^maps\.google\.[a-z.]+$/.test(host)) return true;
  return false;
}

function isFacebookHost(host: string): boolean {
  return (
    host === "facebook.com" ||
    host === "m.facebook.com" ||
    host === "fb.com" ||
    host === "www.fb.com"
  );
}

function isInstagramHost(host: string): boolean {
  return host === "instagram.com";
}

function pathAllowsGoogleMaps(host: string, pathname: string): boolean {
  const path = pathname.toLowerCase();
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") {
    return path === "/maps" || path.startsWith("/maps/");
  }
  if (host === "google.com" || host.endsWith(".google.com")) {
    return path === "/maps" || path.startsWith("/maps/");
  }
  if (host.startsWith("maps.google.")) {
    return true;
  }
  return false;
}

function stripTrackingParams(url: URL): void {
  const toDelete: string[] = [];
  url.searchParams.forEach((_value, key) => {
    const lower = key.toLowerCase();
    if (
      TRACKING_PARAM_NAMES.has(lower) ||
      TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix))
    ) {
      toDelete.push(key);
    }
  });
  for (const key of toDelete) {
    url.searchParams.delete(key);
  }
}

function detectKind(host: string, pathname: string): VenueLinkKind | null {
  if (isGoogleMapsHost(host) && pathAllowsGoogleMaps(host, pathname)) {
    return "google_maps";
  }
  if (isFacebookHost(host)) {
    return "facebook";
  }
  if (isInstagramHost(host)) {
    return "instagram";
  }
  return null;
}

/**
 * Validates and normalizes a public venue link (Google Maps / Facebook / Instagram).
 * Only https URLs on allowlisted hosts are accepted.
 */
export function parseVenueLink(url: string): ParseVenueLinkResult {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (!trimmed) {
    return { ok: false, error: "Venue link is required" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Venue link must be a valid URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Venue link must use https" };
  }

  const host = hostnameWithoutWww(parsed.hostname);
  // Reject look-alike hosts (e.g. facebook.com.evil.io) — host must match exactly
  // after stripping a single leading www.
  const kind = detectKind(host, parsed.pathname);
  if (!kind) {
    return {
      ok: false,
      error:
        "Venue link must be a Google Maps, Facebook, or Instagram page URL",
    };
  }

  stripTrackingParams(parsed);
  // Drop hash fragments for a stable normalized form
  parsed.hash = "";

  return {
    ok: true,
    kind,
    normalizedUrl: parsed.toString(),
  };
}

export function venueLinkKindLabel(kind: VenueLinkKind): string {
  switch (kind) {
    case "google_maps":
      return "Google Maps";
    case "facebook":
      return "Facebook";
    case "instagram":
      return "Instagram";
  }
}
