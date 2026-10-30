import { defaultLocale, isValidLocale, type Locale } from "./config";

/** Cookie next-intl reads when locale prefixes are not used. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function resolveLocale(value: string | undefined | null): Locale {
  if (value && isValidLocale(value)) {
    return value;
  }
  return defaultLocale;
}

/** Read the locale cookie from a raw Cookie header. */
export function localeFromCookieHeader(header: string | null | undefined): Locale {
  if (!header) {
    return defaultLocale;
  }
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
  if (!match) {
    return defaultLocale;
  }
  return resolveLocale(decodeURIComponent(match.slice(LOCALE_COOKIE.length + 1)));
}
