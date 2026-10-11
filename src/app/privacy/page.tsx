import React from "react";
import { getTranslations } from "next-intl/server";
import { Header, Footer } from "@/components/layout";
import { DraftLegalBanner } from "@/components/marketing";

export default async function PrivacyPage(): Promise<React.ReactElement> {
  const t = await getTranslations("privacyPage");

  const sections = [
    { title: t("whoWeAreTitle"), body: t("whoWeAreBody") },
    { title: t("dataCollectedTitle"), body: t("dataCollectedBody") },
    { title: t("howWeUseTitle"), body: t("howWeUseBody") },
    { title: t("retentionTitle"), body: t("retentionBody") },
    { title: t("sharingTitle"), body: t("sharingBody") },
    { title: t("yourRightsTitle"), body: t("yourRightsBody") },
    { title: t("contactTitle"), body: t("contactBody") },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950">
        <article className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <DraftLegalBanner label={t("draftBanner")} />
            <h1 className="text-3xl font-bold text-charcoal-100 sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-3 text-base text-charcoal-400">{t("intro")}</p>

            <div className="mt-8 space-y-8">
              {sections.map((section) => (
                <section key={section.title}>
                  <h2 className="text-xl font-semibold text-charcoal-100">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal-400 whitespace-pre-wrap">
                    {section.body}
                  </p>
                </section>
              ))}
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
