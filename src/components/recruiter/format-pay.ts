export function formatOpeningPay(params: {
  payMin: number | null;
  payMax: number | null;
  payCurrency?: string;
  payPeriod?: string;
}): string | null {
  const currency = params.payCurrency || "THB";
  const period = params.payPeriod || "night";
  const suffix = `${currency} / ${period}`;

  if (params.payMin != null && params.payMax != null) {
    return `${params.payMin.toLocaleString()} – ${params.payMax.toLocaleString()} ${suffix}`;
  }
  if (params.payMin != null) {
    return `From ${params.payMin.toLocaleString()} ${suffix}`;
  }
  if (params.payMax != null) {
    return `Up to ${params.payMax.toLocaleString()} ${suffix}`;
  }
  return null;
}

export function emptyPayToNull(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}
