export function formatVenueAreaLabel(
  area: string | null | undefined,
  subArea: string | null | undefined
): string | null {
  const trimmedArea = area?.trim() ?? "";
  const trimmedSubArea = subArea?.trim() ?? "";

  if (trimmedArea && trimmedSubArea) {
    return `${trimmedArea} · ${trimmedSubArea}`;
  }
  if (trimmedArea) {
    return trimmedArea;
  }
  if (trimmedSubArea) {
    return trimmedSubArea;
  }
  return null;
}
