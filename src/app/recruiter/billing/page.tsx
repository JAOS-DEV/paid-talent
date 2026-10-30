import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header, Footer } from "@/components/layout";
import { RecruiterBillingPanel } from "@/components/recruiter";
import { getRecruiterBillingSummary } from "@/lib/billing/summary";

export default async function RecruiterBillingPage(): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "recruiter") {
    redirect("/auth/signin");
  }

  const summary = await getRecruiterBillingSummary(session.user.id);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="mx-auto max-w-lg px-4">
          <RecruiterBillingPanel summary={summary} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
