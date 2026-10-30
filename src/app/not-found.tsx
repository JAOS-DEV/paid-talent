import React from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Header, Footer } from "@/components/layout";
import { Button } from "@/components/ui";

export default async function NotFound(): Promise<React.ReactElement> {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center bg-charcoal-950 px-4 py-16">
        <div className="w-full max-w-md text-center">
          <p className="text-sm font-semibold text-primary-300">404</p>
          <h1 className="mt-2 text-3xl font-bold text-charcoal-100">{t("title")}</h1>
          <p className="mt-3 text-base text-charcoal-200">{t("body")}</p>
          <div className="mt-8 flex justify-center">
            <Link href="/">
              <Button type="button">{t("home")}</Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
