"use client";

import { useLocale as useNextIntlLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setUserLocale } from "./actions";
import { locales, localeNames, type Locale } from "./config";

export function useLocale() {
  const locale = useNextIntlLocale() as Locale;
  const router = useRouter();

  const switchLocale = async (newLocale: Locale): Promise<void> => {
    if (newLocale === locale) {
      return;
    }
    await setUserLocale(newLocale);
    router.refresh();
  };

  return {
    locale,
    locales,
    localeNames,
    switchLocale,
  };
}

export { useTranslations };
