"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, Card, CardContent } from "@/components/ui";
import { isPendingSignupUser } from "@/lib/auth/pending-signup";
import type { UserRole } from "@/types/auth";

function RoleSelectForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRole = searchParams.get("role");

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(
    preselectedRole === "worker" || preselectedRole === "recruiter"
      ? preselectedRole
      : null
  );

  const handleContinue = (): void => {
    if (!selectedRole) return;

    const params = new URLSearchParams();
    params.set("role", selectedRole);
    router.push(`/auth/age-gate?${params.toString()}`);
  };

  return (
    <>
      <div className="space-y-4">
        <Card
          hover
          padding="lg"
          className={`cursor-pointer transition-all ${
            selectedRole === "worker"
              ? "ring-2 ring-primary-500 border-primary-500"
              : ""
          }`}
          onClick={() => setSelectedRole("worker")}
        >
          <CardContent>
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-full bg-primary-600/20 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-primary-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-charcoal-100 mb-1">
                  I&apos;m a Worker
                </h3>
                <p className="text-charcoal-400 text-sm">
                  Create a profile, showcase your skills, and connect with
                  recruiters looking for talent like you.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          hover
          padding="lg"
          className={`cursor-pointer transition-all ${
            selectedRole === "recruiter"
              ? "ring-2 ring-primary-500 border-primary-500"
              : ""
          }`}
          onClick={() => setSelectedRole("recruiter")}
        >
          <CardContent>
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-full bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-gold-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-charcoal-100 mb-1">
                  I&apos;m a Recruiter
                </h3>
                <p className="text-charcoal-400 text-sm">
                  Search for talented workers, view profiles, and unlock
                  contact details for Top Talent.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Button
          fullWidth
          size="lg"
          disabled={!selectedRole}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </div>
    </>
  );
}

function RoleSelectHeader(): React.ReactElement {
  const { data: session } = useSession();
  const pendingSignup = isPendingSignupUser(session?.user);

  return (
    <div className="text-center mb-8">
      <h1 className="text-2xl font-bold text-charcoal-100 mb-2">
        {pendingSignup
          ? "Looks like you're new to Paid Talent"
          : "Welcome to Paid Talent"}
      </h1>
      <p className="text-charcoal-400">
        {pendingSignup
          ? "Let's finish creating your account."
          : "Choose how you want to use the platform"}
      </p>
    </div>
  );
}

function RoleSelectFooter(): React.ReactElement | null {
  const { data: session } = useSession();
  if (isPendingSignupUser(session?.user)) {
    return null;
  }

  return (
    <p className="text-center text-charcoal-500 text-sm mt-6">
      Already have an account?{" "}
      <a
        href="/auth/signin"
        className="text-primary-400 hover:text-primary-300"
      >
        Sign in
      </a>
    </p>
  );
}

export default function RoleSelectPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <RoleSelectHeader />

        <Suspense fallback={
          <div className="space-y-4">
            <div className="h-32 bg-charcoal-800 rounded-xl animate-pulse" />
            <div className="h-32 bg-charcoal-800 rounded-xl animate-pulse" />
          </div>
        }>
          <RoleSelectForm />
        </Suspense>

        <RoleSelectFooter />
      </div>
    </div>
  );
}
