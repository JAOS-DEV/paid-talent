import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header, Footer } from "@/components/layout";
import { OpeningForm } from "@/components/recruiter";

export default async function NewOpeningPage(): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "recruiter") {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link
              href="/recruiter/openings"
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              ← Back to openings
            </Link>
            <h1 className="text-2xl font-bold text-charcoal-100 mt-3">
              New opening
            </h1>
          </div>
          <OpeningForm mode="create" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
