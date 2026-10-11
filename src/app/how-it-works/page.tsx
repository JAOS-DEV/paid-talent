import React from "react";
import { getTranslations } from "next-intl/server";
import { Header, Footer } from "@/components/layout";
import { StepList } from "@/components/marketing";

export default async function HowItWorksPage(): Promise<React.ReactElement> {
  const t = await getTranslations("howItWorksPage");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950">
        <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-bold text-charcoal-100 sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-3 text-base text-charcoal-400 sm:text-lg">
              {t("subtitle")}
            </p>

            <div className="mt-10 space-y-10">
              <section>
                <h2 className="mb-4 text-xl font-semibold text-primary-400">
                  {t("forTalent")}
                </h2>
                <StepList
                  accent="primary"
                  steps={[
                    {
                      title: t("talentStep1Title"),
                      body: t("talentStep1Body"),
                    },
                    {
                      title: t("talentStep2Title"),
                      body: t("talentStep2Body"),
                    },
                    {
                      title: t("talentStep3Title"),
                      body: t("talentStep3Body"),
                    },
                  ]}
                />
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-gold-400">
                  {t("forRecruiters")}
                </h2>
                <StepList
                  accent="gold"
                  steps={[
                    {
                      title: t("recruiterStep1Title"),
                      body: t("recruiterStep1Body"),
                    },
                    {
                      title: t("recruiterStep2Title"),
                      body: t("recruiterStep2Body"),
                    },
                    {
                      title: t("recruiterStep3Title"),
                      body: t("recruiterStep3Body"),
                    },
                  ]}
                />
              </section>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
