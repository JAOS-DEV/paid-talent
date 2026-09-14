/**
 * Format stored moderation confidence for admin UI.
 * Pipeline stores INTEGER PERCENT (e.g. 85), not a 0–1 fraction.
 */
export function formatModerationConfidencePercent(
  confidence: number | null | undefined
): string {
  if (confidence == null || Number.isNaN(confidence)) {
    return "—";
  }
  return `${Math.round(confidence)}%`;
}
