import React from "react";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { Header, Footer } from "@/components/layout";
import { OpeningForm, RecruiterBackLink } from "@/components/recruiter";
import { getOpening } from "@/lib/recruiter-profile/actions";

interface EditOpeningPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditOpeningPage({
  params,
}: EditOpeningPageProps): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "recruiter") {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const opening = await getOpening(id);

  if (!opening) {
    notFound();
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
          <OpeningForm mode="edit" initialOpening={opening} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
