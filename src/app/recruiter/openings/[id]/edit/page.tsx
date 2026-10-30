import React from "react";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { Header, Footer } from "@/components/layout";
import { OpeningForm, RecruiterBackLink } from "@/components/recruiter";
import { getOpening } from "@/lib/recruiter-profile/actions";
import { listVenueOptionsForUser } from "@/lib/venues/recruiter-helpers";

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
  const [opening, venues] = await Promise.all([
    getOpening(id),
    listVenueOptionsForUser(session.user.id),
  ]);

  if (!opening) {
    notFound();
  }

  const t = await getTranslations("recruiter.openings");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <RecruiterBackLink href="/recruiter/openings">
              {t("backToOpenings")}
            </RecruiterBackLink>
          </div>
          <OpeningForm mode="edit" initialOpening={opening} venues={venues} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
