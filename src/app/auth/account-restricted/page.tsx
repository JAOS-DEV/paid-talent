import React from "react";
import { Header, Footer } from "@/components/layout";

interface AccountRestrictedPageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function AccountRestrictedPage({
  searchParams,
}: AccountRestrictedPageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const banned = params.reason === "banned";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 px-4 py-16">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl font-bold text-charcoal-100">
            {banned ? "This account is banned" : "This account is suspended"}
          </h1>
          <p className="mt-4 text-charcoal-400">
            {banned
              ? "This verified identity cannot sign in or create a new Paid Talent account."
              : "This account cannot be used until an administrator reactivates it."}
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
