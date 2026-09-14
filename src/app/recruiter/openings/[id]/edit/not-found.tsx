import React from "react";
import Link from "next/link";
import { Header, Footer } from "@/components/layout";
import { Button, Card, CardContent } from "@/components/ui";

export default function OpeningNotFound(): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-lg mx-auto px-4">
          <Card padding="lg">
            <CardContent className="text-center space-y-4 py-8">
              <h1 className="text-xl font-semibold text-charcoal-100">
                Opening not found
              </h1>
              <p className="text-charcoal-400 text-sm">
                This opening is unavailable or you do not have access to it.
              </p>
              <Link href="/recruiter/openings">
                <Button>Back to openings</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
