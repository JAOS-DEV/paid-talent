"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components/layout";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { WorkerPublicProfileView } from "@/components/worker-profile";
import type { PublicWorkerProfileView } from "@/lib/worker-profile/public-profile";

export default function WorkerProfilePreviewPage(): React.ReactElement {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("worker.publicProfile");
  const dashboard = useTranslations("worker.dashboard");
  const [profile, setProfile] = useState<PublicWorkerProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (session.user.role !== "worker") {
      router.replace("/auth/signin");
      return;
    }

    let cancelled = false;
    async function run(): Promise<void> {
      try {
        const response = await fetch("/api/worker/profile/preview");
        if (cancelled) return;
        if (response.status === 404) {
          setError(t("profileNotFound"));
          return;
        }
        if (!response.ok) {
          setError(t("previewLoadFailed"));
          return;
        }
        const data = (await response.json()) as {
          profile: PublicWorkerProfileView;
        };
        if (cancelled) return;
        setProfile(data.profile);
      } catch {
        if (!cancelled) {
          setError(t("previewLoadFailed"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [session, router, t]);

  if (status === "loading" || !session || session.user.role !== "worker") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-hidden">
          <Link
            href="/worker/dashboard"
            className="inline-flex items-center text-charcoal-400 hover:text-charcoal-200 mb-6 transition-colors min-h-11"
          >
            {t("backToDashboard")}
          </Link>

          {loading ? (
            <div className="h-64 rounded-xl bg-charcoal-800 animate-pulse" />
          ) : error || !profile ? (
            <Card padding="lg">
              <CardContent className="text-center py-12">
                <CardHeader>
                  <CardTitle>{error || t("profileNotFound")}</CardTitle>
                </CardHeader>
                <p className="text-charcoal-400 mb-6">
                  {t("completeBeforePreview")}
                </p>
                <Link href="/worker/profile">
                  <Button>{dashboard("editProfile")}</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <WorkerPublicProfileView profile={profile} mode="preview" />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
