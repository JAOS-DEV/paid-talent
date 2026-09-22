import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header, Footer } from "@/components/layout";
import { RecruiterBackLink, RecruiterProfileForm } from "@/components/recruiter";
import { getRecruiterProfile } from "@/lib/recruiter-profile/actions";

export default async function RecruiterOwnProfilePage(): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "recruiter") {
    redirect("/auth/signin");
  }

  const profile = await getRecruiterProfile();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-6 min-w-0">
            <RecruiterBackLink href="/recruiter/dashboard">
              ← Back to Dashboard
            </RecruiterBackLink>
          </div>
          <RecruiterProfileForm initialProfile={profile} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
