"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/lib/i18n/useLocale";
import type { Locale } from "@/lib/i18n/config";

const SHORT_LABEL: Record<Locale, string> = {
  en: "EN",
  th: "ไทย",
};

export function LanguageToggle(): React.ReactElement {
  const t = useTranslations("language");
  const { locale, locales, localeNames, switchLocale } = useLocale();
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);

  const handleSelect = (nextLocale: Locale): void => {
    if (nextLocale === locale || pendingLocale) {
      return;
    }
    setPendingLocale(nextLocale);
    void switchLocale(nextLocale).finally(() => {
      setPendingLocale(null);
    });
  };

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="inline-flex items-center rounded-lg border border-charcoal-600 bg-charcoal-800 p-0.5"
    >
      {locales.map((code, index) => {
        const selected = locale === code;
        return (
          <React.Fragment key={code}>
            {index > 0 ? (
              <span className="px-0.5 text-charcoal-600 select-none" aria-hidden="true">
                |
              </span>
            ) : null}
            <button
              type="button"
              aria-pressed={selected}
              aria-label={localeNames[code]}
              disabled={pendingLocale !== null}
              onClick={() => handleSelect(code)}
              className={`min-h-11 min-w-11 px-2.5 text-sm font-semibold rounded-md transition-colors ${
                selected
                  ? "bg-primary-600 text-white"
                  : "text-charcoal-300 hover:text-charcoal-100 hover:bg-charcoal-700"
              }`}
            >
              {SHORT_LABEL[code]}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
