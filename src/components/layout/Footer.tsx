"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function Footer(): React.ReactElement {
  const t = useTranslations("footer");

  return (
    <footer className="bg-charcoal-900 border-t border-charcoal-700 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-lg font-bold text-primary-500">Paid</span>
              <span className="text-lg font-bold text-gold-500">Talent</span>
            </div>
            <p className="text-charcoal-400 text-sm">{t("tagline")}</p>
          </div>

          <div>
            <h4 className="text-charcoal-200 font-medium mb-3">{t("forWorkers")}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/auth/age-gate?role=worker"
                  className="text-charcoal-400 hover:text-charcoal-200 transition-colors"
                >
                  {t("createProfile")}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-charcoal-400 hover:text-charcoal-200 transition-colors"
                >
                  {t("howItWorks")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-charcoal-200 font-medium mb-3">
              {t("forRecruiters")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/auth/age-gate?role=recruiter"
                  className="text-charcoal-400 hover:text-charcoal-200 transition-colors"
                >
                  {t("startRecruiting")}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-charcoal-400 hover:text-charcoal-200 transition-colors"
                >
                  {t("topTalent")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-charcoal-200 font-medium mb-3">{t("legal")}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="#"
                  className="text-charcoal-400 hover:text-charcoal-200 transition-colors"
                >
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-charcoal-400 hover:text-charcoal-200 transition-colors"
                >
                  {t("terms")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-charcoal-700 mt-8 pt-8 text-center">
          <p className="text-charcoal-500 text-sm">
            {t("rights", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}
