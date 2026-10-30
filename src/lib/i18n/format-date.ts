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
