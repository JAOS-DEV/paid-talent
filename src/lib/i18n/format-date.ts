/** Active-locale calendar date. th-TH uses Thai day/month order and the Buddhist year. */
export function formatLocaleDate(
  value: Date | string | null | undefined,
  locale: string
): string {
  if (value == null || value === "") {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Short relative time for inbox rows. */
export function formatRelativeTime(
  value: Date | string | null | undefined,
  locale: string,
  now: Date = new Date()
): string {
  if (value == null || value === "") {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(locale === "th" ? "th" : "en", {
    numeric: "auto",
  });
  if (abs < 60) {
    return rtf.format(Math.round(diffSeconds), "second");
  }
  if (abs < 3600) {
    return rtf.format(Math.round(diffSeconds / 60), "minute");
  }
  if (abs < 86400) {
    return rtf.format(Math.round(diffSeconds / 3600), "hour");
  }
  if (abs < 86400 * 7) {
    return rtf.format(Math.round(diffSeconds / 86400), "day");
  }
  return formatLocaleDate(date, locale);
}
