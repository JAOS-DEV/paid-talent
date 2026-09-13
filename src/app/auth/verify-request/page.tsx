"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, Button } from "@/components/ui";

export default function VerifyRequestPage(): React.ReactElement {
  const router = useRouter();

  const handleBackToSignIn = (): void => {
    router.push("/auth/signin");
  };

  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <span className="text-2xl font-bold text-primary-500">Paid</span>
            <span className="text-2xl font-bold text-gold-500">Talent</span>
          </div>
          <h1 className="text-xl font-semibold text-charcoal-100 mb-2">
            Check your email
          </h1>
          <p className="text-charcoal-400 text-sm">
            A sign-in link has been sent to your email address.
          </p>
        </div>

        <Card padding="lg">
          <CardContent className="space-y-6 text-center">
            <div className="w-16 h-16 mx-auto bg-primary-500/10 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-primary-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            <div className="space-y-2">
              <p className="text-charcoal-200">
                Click the link in your email to sign in securely.
              </p>
              <p className="text-charcoal-500 text-sm">
                The link will expire in 24 hours for your security.
              </p>
            </div>

            <div className="pt-4 border-t border-charcoal-800">
              <p className="text-charcoal-500 text-sm mb-4">
                Didn&apos;t receive the email? Check your spam folder or try again.
              </p>
              <Button
                variant="outline"
                fullWidth
                onClick={handleBackToSignIn}
              >
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-charcoal-600 text-xs mt-6">
          For security, we send a unique link instead of using passwords.
          <br />
          This protects your account from unauthorized access.
        </p>
      </div>
    </div>
  );
}
