"use client";

import { useLocale as useNextIntlLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "./config";

export function useLocale() {
  const locale = useNextIntlLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: Locale): void => {
    const currentLocale = locale;
    let newPath = pathname;

    if (pathname.startsWith(`/${currentLocale}/`)) {
      newPath = pathname.replace(`/${currentLocale}/`, `/${newLocale}/`);
    } else if (pathname === `/${currentLocale}`) {
      newPath = `/${newLocale}`;
    } else {
      newPath = `/${newLocale}${pathname}`;
    }

    router.push(newPath);
  };

  return {
    locale,
    locales,
    localeNames,
    switchLocale,
  };
}

export { useTranslations };
