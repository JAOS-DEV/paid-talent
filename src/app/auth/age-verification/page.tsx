"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { AuthLocaleBar } from "@/components/i18n";
import { meetsMinimumAge } from "@/lib/helpers/age-verification";

export default function AgeVerificationPage(): React.ReactElement {
  const t = useTranslations("ageVerification");
  const router = useRouter();
  const { data: session, status, update: updateSession } = useSession();

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const maxDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  const handleDateOfBirthChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      setDateOfBirth(event.target.value);
      setError(null);
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!dateOfBirth) {
      setError(t("enterDob"));
      return;
    }

    const dob = new Date(dateOfBirth);

    if (!meetsMinimumAge(dob)) {
      setError(
        t("underAge")
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify-age", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateOfBirth }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("failed"));
        setIsLoading(false);
        return;
      }

      await updateSession({ ageVerified: true });

      router.push(data.redirectUrl || "/");
      router.refresh();
    } catch {
      setError(t("genericError"));
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md min-w-0">
          <Card padding="lg" className="w-full min-w-0">
            <CardContent>
              <div className="animate-pulse space-y-4">
                <div className="h-10 bg-charcoal-700 rounded" />
                <div className="h-10 bg-charcoal-700 rounded" />
                <div className="h-12 bg-charcoal-700 rounded" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated" || !session) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
        <p className="text-charcoal-400">{t("redirecting")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
      <AuthLocaleBar />
      <div className="w-full max-w-md min-w-0">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary-600/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-primary-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-charcoal-100 mb-2">
            {t("title")}
          </h1>
          <p className="text-charcoal-400">
            {t("subtitle")}
          </p>
        </div>

        <Card padding="lg" className="w-full min-w-0">
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6 w-full min-w-0">
              <div className="w-full min-w-0 max-w-full overflow-hidden">
                <Input
                  type="date"
                  label={t("dateLabel")}
                  value={dateOfBirth}
                  onChange={handleDateOfBirthChange}
                  max={maxDate}
                  required
                  className="w-full min-w-0 max-w-full"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={isLoading}
                disabled={!dateOfBirth || isLoading}
              >
                {t("submit")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-charcoal-500 text-xs mt-6">
          {t("footnote")}
        </p>
      </div>
    </div>
  );
}
