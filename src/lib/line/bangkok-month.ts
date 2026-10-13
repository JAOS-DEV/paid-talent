const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Bangkok calendar month key `YYYY-MM` (Asia/Bangkok, UTC+7, no DST).
 */
export function bangkokMonthKey(now: Date = new Date()): string {
  const bangkokMs = now.getTime() + BANGKOK_OFFSET_MS;
  const d = new Date(bangkokMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
