import React from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { Header, Footer } from "@/components/layout";
import { OpeningForm, RecruiterBackLink } from "@/components/recruiter";

export default async function NewOpeningPage(): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "recruiter") {
    redirect("/auth/signin");
  }

  const t = await getTranslations("recruiter.openings");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-6">
            <RecruiterBackLink href="/recruiter/openings">
              {t("backToOpenings")}
            </RecruiterBackLink>
          </div>
          <OpeningForm mode="create" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
