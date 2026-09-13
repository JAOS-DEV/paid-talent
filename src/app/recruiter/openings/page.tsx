import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header, Footer } from "@/components/layout";
import { Button, Card, CardContent } from "@/components/ui";
import { OpeningCard } from "@/components/recruiter";
import { EMPTY_STATE_COPY } from "@/lib/interests";
import { getRecruiterOpenings } from "@/lib/recruiter-profile/actions";

export default async function RecruiterOpeningsPage(): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "recruiter") {
    redirect("/auth/signin");
  }

  const openings = await getRecruiterOpenings();
  const publishedCount = openings.filter((o) => o.isPublished).length;
  const draftCount = openings.length - publishedCount;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-charcoal-100">Openings</h1>
              <p className="text-charcoal-400 mt-1">
                Create and publish roles workers can see when you express
                interest.
              </p>
              {openings.length > 0 && (
                <p className="text-sm text-charcoal-500 mt-2">
                  {publishedCount} published · {draftCount} draft
                </p>
              )}
            </div>
            <Link href="/recruiter/openings/new">
              <Button>Add opening</Button>
            </Link>
          </div>

          {openings.length === 0 ? (
            <Card padding="lg">
              <CardContent className="text-center py-10">
                <p className="text-lg text-charcoal-200">
                  {EMPTY_STATE_COPY.recruiterNoOpenings}
                </p>
                <p className="text-charcoal-400 mt-2">
                  {EMPTY_STATE_COPY.recruiterNoOpeningsCta}
                </p>
                <Link href="/recruiter/openings/new" className="inline-block mt-6">
                  <Button>Add opening</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {openings.map((opening) => (
                <OpeningCard key={opening.id} opening={opening} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
