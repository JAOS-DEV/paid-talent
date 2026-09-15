import React from "react";
import { notFound, redirect } from "next/navigation";
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <RecruiterBackLink href="/recruiter/openings">
              ← Back to openings
            </RecruiterBackLink>
            <h1 className="text-2xl font-bold text-charcoal-100 mt-3">
              Edit opening
            </h1>
          </div>
          <OpeningForm mode="edit" initialOpening={opening} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
