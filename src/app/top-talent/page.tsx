import React from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Header, Footer } from "@/components/layout";
import { PRICING_HREF } from "@/lib/recruiter-access/teaser-cta";
import { TopTalentBadge } from "@/components/ui";
import { TopTalentCta } from "@/components/marketing";

export default async function TopTalentPage(): Promise<React.ReactElement> {
  const t = await getTranslations("topTalentPage");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950">
        <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4">
              <TopTalentBadge />
            </div>
            <h1 className="text-3xl font-bold text-charcoal-100 sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-3 text-base text-charcoal-400 sm:text-lg">
              {t("subtitle")}
            </p>

            <div className="mt-8 space-y-6">
              <section className="rounded-xl border border-charcoal-700 bg-charcoal-900/60 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-charcoal-100">
                  {t("whatItIsTitle")}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-charcoal-400">
                  {t("whatItIsBody")}
                </p>
              </section>

              <section className="rounded-xl border border-charcoal-700 bg-charcoal-900/60 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-charcoal-100">
                  {t("whoItsForTitle")}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-charcoal-400">
                  {t("whoItsForBody")}
                </p>
              </section>

              <section className="rounded-xl border border-charcoal-700 bg-charcoal-900/60 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-charcoal-100">
                  {t("howAccessTitle")}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-charcoal-400">
                  {t("howAccessBody")}
                </p>
              </section>
            </div>

            <div className="mt-10 space-y-4">
              <TopTalentCta />
              <Link
                href={PRICING_HREF}
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary-300 hover:text-primary-200"
              >
                {t("pricingLink")}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
