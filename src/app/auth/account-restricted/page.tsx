import React from "react";
import { getTranslations } from "next-intl/server";
import { Header, Footer } from "@/components/layout";

interface AccountRestrictedPageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function AccountRestrictedPage({
  searchParams,
}: AccountRestrictedPageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const banned = params.reason === "banned";
  const t = await getTranslations("accountRestricted");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 px-4 py-16">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl font-bold text-charcoal-100">
            {banned ? t("bannedTitle") : t("suspendedTitle")}
          </h1>
          <p className="mt-4 text-charcoal-400">
            {banned ? t("bannedBody") : t("suspendedBody")}
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
