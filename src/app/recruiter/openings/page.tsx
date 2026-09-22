import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header, Footer } from "@/components/layout";
import { Button, Card, CardContent } from "@/components/ui";
import { OpeningCard, RecruiterBackLink } from "@/components/recruiter";
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
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-6 min-w-0">
            <RecruiterBackLink href="/recruiter/dashboard">
              ← Back to Dashboard
            </RecruiterBackLink>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-charcoal-100">
                  Openings
                </h1>
                <p className="text-charcoal-400 mt-1">
                  Manage your job openings. Workers see these when you express
                  interest.
                </p>
                {openings.length > 0 && (
                  <p className="text-sm text-charcoal-500 mt-2">
                    {publishedCount} published · {draftCount} draft
                  </p>
                )}
              </div>
              <Link href="/recruiter/openings/new" className="flex-shrink-0">
                <Button>Add opening</Button>
              </Link>
            </div>
          </div>

          {openings.length === 0 ? (
            <Card padding="lg">
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-charcoal-800 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-charcoal-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <p className="text-lg font-medium text-charcoal-100">
                  No openings yet
                </p>
                <p className="text-charcoal-400 mt-2">
                  Add openings to start hiring
                </p>
                <Link
                  href="/recruiter/openings/new"
                  className="inline-block mt-6"
                >
                  <Button>Add your first opening</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
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
