"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent } from "@/components/ui";

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The verification link has expired or has already been used.",
  OAuthSignin: "Error occurred during OAuth sign in.",
  OAuthCallback: "Error occurred during OAuth callback.",
  OAuthCreateAccount: "Could not create OAuth account.",
  EmailCreateAccount: "Could not create email account.",
  Callback: "Error occurred during callback.",
  OAuthAccountNotLinked:
    "Email is already associated with another account. Please sign in with that account.",
  EmailSignin: "Check your email for the sign in link.",
  CredentialsSignin: "Sign in failed. Check the details you provided.",
  SessionRequired: "Please sign in to access this page.",
  Default: "An error occurred during authentication.",
};

function ErrorContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";
  const errorMessage = errorMessages[error] || errorMessages.Default;

  return (
    <Card padding="lg">
      <CardContent>
        <p className="text-charcoal-300 text-center mb-6">{errorMessage}</p>

        <div className="space-y-3">
          <Link href="/auth/signin">
            <Button fullWidth>Try Again</Button>
          </Link>
          <Link href="/">
            <Button variant="outline" fullWidth>
              Return Home
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AuthErrorPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-charcoal-100 mb-2">
            Authentication Error
          </h1>
        </div>

        <Suspense fallback={
          <Card padding="lg">
            <CardContent>
              <div className="h-20 bg-charcoal-700 rounded animate-pulse" />
            </CardContent>
          </Card>
        }>
          <ErrorContent />
        </Suspense>
      </div>
    </div>
  );
}
