import React from "react";
import Link from "next/link";
import { Button, Card, CardContent, TopTalentBadge } from "@/components/ui";
import { Header, Footer } from "@/components/layout";
import { AdSense } from "@/components/ads";

export default function HomePage(): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-b from-charcoal-950 via-charcoal-900 to-charcoal-950 py-20 lg:py-32">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-900/20 via-transparent to-transparent" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                <span className="text-charcoal-100">Find </span>
                <span className="text-primary-400">Talented </span>
                <span className="text-charcoal-100">Workers</span>
                <br />
                <span className="text-charcoal-100">or </span>
                <span className="text-gold-500">Get Discovered</span>
              </h1>

              <p className="text-lg md:text-xl text-charcoal-400 mb-8 max-w-2xl mx-auto">
                Paid Talent connects skilled workers with recruiters looking for
                top talent. Create your profile or start recruiting today.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth/role-select?role=worker">
                  <Button size="lg" className="w-full sm:w-auto">
                    Create Worker Profile
                  </Button>
                </Link>
                <Link href="/auth/role-select?role=recruiter">
                  <Button
                    variant="gold"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    Start Recruiting
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-charcoal-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-charcoal-100 mb-12">
              How It Works
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              <Card padding="lg">
                <CardContent className="text-center">
                  <div className="w-14 h-14 rounded-full bg-primary-600/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary-400">
                      1
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-charcoal-100 mb-2">
                    Create Your Profile
                  </h3>
                  <p className="text-charcoal-400 text-sm">
                    Workers build detailed profiles showcasing skills,
                    experience, and availability.
                  </p>
                </CardContent>
              </Card>

              <Card padding="lg">
                <CardContent className="text-center">
                  <div className="w-14 h-14 rounded-full bg-primary-600/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary-400">
                      2
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-charcoal-100 mb-2">
                    Get Discovered
                  </h3>
                  <p className="text-charcoal-400 text-sm">
                    Recruiters search and filter to find the perfect candidates
                    for their needs.
                  </p>
                </CardContent>
              </Card>

              <Card padding="lg">
                <CardContent className="text-center">
                  <div className="w-14 h-14 rounded-full bg-gold-500/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-gold-400">3</span>
                  </div>
                  <h3 className="text-lg font-semibold text-charcoal-100 mb-2">
                    Connect & Hire
                  </h3>
                  <p className="text-charcoal-400 text-sm">
                    Recruiters unlock contact details for Top Talent and connect
                    directly.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 bg-charcoal-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <TopTalentBadge />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-center text-charcoal-100 mb-4">
              Unlock Top Talent
            </h2>
            <p className="text-center text-charcoal-400 mb-8 max-w-xl mx-auto">
              Get access to full contact details for our highest-ranked workers.
              View LINE, WhatsApp, and phone numbers to connect directly.
            </p>

            <div className="flex justify-center">
              <Link href="/auth/role-select?role=recruiter">
                <Button variant="gold" size="lg">
                  Subscribe to Top Talent
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-8 bg-charcoal-950">
          <div className="max-w-3xl mx-auto px-4">
            <AdSense adSlot="landing-page-bottom" adFormat="horizontal" />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
