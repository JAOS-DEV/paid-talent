"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, Card, CardContent } from "@/components/ui";
import { persistSignupIntentRole } from "@/lib/auth/signup-intent-action";
import { isPendingSignupUser } from "@/lib/auth/pending-signup";
import { isValidSignupIntentRole } from "@/lib/auth/sign-in-decision";
import type { UserRole } from "@/types/auth";

function AgeGateForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const pendingSignup = isPendingSignupUser(session?.user);
  const roleParam = searchParams.get("role");
  const role = isValidSignupIntentRole(roleParam ?? undefined)
    ? (roleParam as UserRole)
    : null;

  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirmedChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    setConfirmed(event.target.checked);
    if (event.target.checked) setError(null);
  };

  const handleContinue = async (): Promise<void> => {
    if (!confirmed) {
      setError("Confirm you're 20+ to continue.");
      return;
    }

    if (!role) {
      router.push("/auth/role-select");
      return;
    }

    setError(null);
    setIsLoading(true);

    const result = await persistSignupIntentRole(role);
    if (!result.ok) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    if (pendingSignup) {
      router.push("/auth/age-verification");
      return;
    }

    const params = new URLSearchParams();
    params.set("role", result.role);
    params.set("ageConfirmed", "true");
    router.push(`/auth/signin?${params.toString()}`);
  };

  return (
    <Card padding="lg" className="w-full min-w-0">
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="age-confirm"
                checked={confirmed}
                onChange={handleConfirmedChange}
                className="mt-1 w-5 h-5 min-w-[20px] rounded border-charcoal-600 bg-charcoal-800 text-primary-600 focus:ring-primary-500 focus:ring-offset-charcoal-900"
              />
              <label
                htmlFor="age-confirm"
                className="text-sm text-charcoal-300 leading-relaxed"
              >
                I confirm I am 20 or older.
              </label>
            </div>
            <p className="text-charcoal-500 text-xs">
              You must be 20+ to use Paid Talent.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button
            fullWidth
            size="lg"
            onClick={handleContinue}
            loading={isLoading}
            disabled={isLoading}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgeGatePage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
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
            Age Confirmation
          </h1>
          <p className="text-charcoal-400">
            This platform is for adults only.
          </p>
        </div>

        <Suspense
          fallback={
            <Card padding="lg" className="w-full min-w-0">
              <CardContent>
                <div className="animate-pulse space-y-4">
                  <div className="h-10 bg-charcoal-700 rounded" />
                  <div className="h-12 bg-charcoal-700 rounded" />
                </div>
              </CardContent>
            </Card>
          }
        >
          <AgeGateForm />
        </Suspense>

        <p className="text-center text-charcoal-500 text-xs mt-6">
          20+ only · Thailand
        </p>
      </div>
    </div>
  );
}
