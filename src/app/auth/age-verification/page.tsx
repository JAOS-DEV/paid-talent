"use client";

import React, { useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, Input } from "@/components/ui";
import type { UserRole } from "@/types/auth";

function AgeVerificationForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") as UserRole | null;
  const email = searchParams.get("email");

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const calculateAge = useCallback((dob: string): number => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }, []);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!dateOfBirth) {
      setError("Please enter your date of birth");
      return;
    }

    if (!confirmed) {
      setError("Please confirm that you are 18 years or older");
      return;
    }

    const age = calculateAge(dateOfBirth);

    if (age < 18) {
      setError(
        "You must be 18 years or older to use this platform. Access denied."
      );
      return;
    }

    if (!role) {
      router.push("/auth/role-select");
      return;
    }

    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("role", role);
      params.set("dob", dateOfBirth);
      if (email) params.set("email", email);

      router.push(`/auth/signin?${params.toString()}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card padding="lg">
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            type="date"
            label="Date of Birth"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            required
          />

          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="age-confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-charcoal-600 bg-charcoal-800 text-primary-600 focus:ring-primary-500 focus:ring-offset-charcoal-900"
            />
            <label
              htmlFor="age-confirm"
              className="text-sm text-charcoal-300"
            >
              I confirm that I am 18 years of age or older and agree to the
              terms of service
            </label>
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
            disabled={!dateOfBirth || !confirmed}
          >
            Verify & Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AgeVerificationPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
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
            Age Verification
          </h1>
          <p className="text-charcoal-400">
            This platform is for users 18 years and older only
          </p>
        </div>

        <Suspense fallback={
          <Card padding="lg">
            <CardContent>
              <div className="animate-pulse space-y-4">
                <div className="h-10 bg-charcoal-700 rounded" />
                <div className="h-10 bg-charcoal-700 rounded" />
              </div>
            </CardContent>
          </Card>
        }>
          <AgeVerificationForm />
        </Suspense>

        <p className="text-center text-charcoal-500 text-xs mt-6">
          Your date of birth is stored securely and used only for age
          verification purposes.
        </p>
      </div>
    </div>
  );
}
