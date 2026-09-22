import { defaultLocale, isValidLocale, type Locale } from "./config";

/** Cookie next-intl reads when locale prefixes are not used. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function resolveLocale(value: string | undefined | null): Locale {
  if (value && isValidLocale(value)) {
    return value;
  }
  return defaultLocale;
}
