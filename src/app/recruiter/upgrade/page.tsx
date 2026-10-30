import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header, Footer } from "@/components/layout";
import { RecruiterUpgradePanel } from "@/components/recruiter";

export default async function RecruiterUpgradePage(): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "recruiter") {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <RecruiterUpgradePanel />
        </div>
      </main>
      <Footer />
    </div>
  );
}
