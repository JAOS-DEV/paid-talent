import React from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button, Card, CardContent, TopTalentBadge } from "@/components/ui";
import { Header, Footer } from "@/components/layout";
import { AdSense } from "@/components/ads";
import { getBillingAccessMode } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<React.ReactElement> {
  let openAccess = false;
  try {
    openAccess = (await getBillingAccessMode()) === "open_access";
  } catch {
    openAccess = false;
  }
  const t = await getTranslations("home");
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-b from-charcoal-950 via-charcoal-900 to-charcoal-950 py-20 lg:py-32">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-900/20 via-transparent to-transparent" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                <span className="text-charcoal-100">{t("find")}</span>
                <span className="text-primary-400">{t("talented")}</span>
                <span className="text-charcoal-100">{t("workers")}</span>
                <br />
                <span className="text-charcoal-100">{t("or")}</span>
                <span className="text-gold-500">{t("getDiscovered")}</span>
              </h1>

              <p className="text-lg md:text-xl text-charcoal-400 mb-8 max-w-2xl mx-auto">
                {t("subtitle")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth/age-gate?role=worker">
                  <Button size="lg" className="w-full sm:w-auto">
                    {t("createWorkerProfile")}
                  </Button>
                </Link>
                <Link href="/auth/age-gate?role=recruiter">
                  <Button
                    variant="gold"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    {t("startRecruiting")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-charcoal-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-charcoal-100 mb-12">
              {t("howItWorks")}
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              <Card padding="lg">
                <CardContent className="text-center">
                  <div className="w-14 h-14 rounded-full bg-primary-600/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary-400">
                      1
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-charcoal-100 mb-2">
                    {t("step1Title")}
                  </h3>
                  <p className="text-charcoal-400 text-sm">{t("step1Body")}</p>
                </CardContent>
              </Card>

              <Card padding="lg">
                <CardContent className="text-center">
                  <div className="w-14 h-14 rounded-full bg-primary-600/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary-400">
                      2
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-charcoal-100 mb-2">
                    {t("step2Title")}
                  </h3>
                  <p className="text-charcoal-400 text-sm">{t("step2Body")}</p>
                </CardContent>
              </Card>

              <Card padding="lg">
                <CardContent className="text-center">
                  <div className="w-14 h-14 rounded-full bg-gold-500/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-gold-400">3</span>
                  </div>
                  <h3 className="text-lg font-semibold text-charcoal-100 mb-2">
                    {t("step3Title")}
                  </h3>
                  <p className="text-charcoal-400 text-sm">{t("step3Body")}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 bg-charcoal-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <TopTalentBadge />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-center text-charcoal-100 mb-4">
              {openAccess ? t("meetTopTalent") : t("unlockTopTalent")}
            </h2>
            <p className="text-center text-charcoal-400 mb-8 max-w-xl mx-auto">
              {openAccess ? t("openAccessBody") : t("subscribeBody")}
            </p>

            <div className="flex justify-center">
              <Link href="/auth/age-gate?role=recruiter">
                <Button variant="gold" size="lg">
                  {openAccess ? t("startRecruiting") : t("subscribeCta")}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-8 bg-charcoal-950">
          <div className="max-w-3xl mx-auto px-4">
            <AdSense adSlot="landing-page-bottom" adFormat="horizontal" />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
