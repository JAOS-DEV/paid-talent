"use client";

import React, { useState, Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Card, CardContent, Input } from "@/components/ui";

const errorMessages: Record<string, string> = {
  CredentialsSignin: "No account found with that email. Please check your email or sign up.",
  OAuthAccountNotLinked: "Email already associated with another account.",
  EmailSignin: "Could not send sign-in email. Please check your email address or try again.",
  EmailNotConfigured: "Email sign-in is not available. Please use Google to sign in.",
  Default: "An error occurred during sign in.",
};

interface AuthConfig {
  emailEnabled: boolean;
  devBypassEnabled: boolean;
}

function SignInForm(): React.ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const role = searchParams.get("role");
  const dob = searchParams.get("dob");
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(errorParam);
  const [formError, setFormError] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({ 
    emailEnabled: false, 
    devBypassEnabled: false 
  });

  const isLegacySignupMode = Boolean(role && dob);
  const isSignupMode = isLegacySignupMode;

  useEffect(() => {
    fetch("/api/auth/config")
      .then((res) => res.json())
      .then((data: AuthConfig) => setAuthConfig(data))
      .catch(() => {});
  }, []);

  const handleGoogleSignIn = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setFormError(null);

    const finalCallbackUrl =
      isLegacySignupMode && role && dob
        ? `/api/auth/register?role=${role}&dob=${dob}&callbackUrl=${encodeURIComponent(callbackUrl)}`
        : callbackUrl;

    await signIn("google", { callbackUrl: finalCallbackUrl });
  };

  const handleEmailSignIn = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setFormError(null);
    setIsLoading(true);

    // In signup mode, register the user first via POST API
    if (isSignupMode) {
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role, dob }),
        });

        if (!response.ok) {
          const data = await response.json();
          setIsLoading(false);
          setFormError(data.error || "Registration failed. Please try again.");
          return;
        }
      } catch {
        setIsLoading(false);
        setFormError("Registration failed. Please try again.");
        return;
      }
    }

    const finalCallbackUrl = isSignupMode
      ? role === "worker"
        ? "/worker/onboarding"
        : "/recruiter/dashboard"
      : callbackUrl;

    try {
      // If dev bypass is enabled, use credentials provider for immediate sign-in
      if (authConfig.devBypassEnabled) {
        const result = await signIn("credentials", {
          email,
          redirect: false,
        });

        if (result?.error) {
          if (isSignupMode) {
            setFormError("Account created but sign-in failed. Please try signing in again.");
          } else {
            setError(result.error);
          }
          setIsLoading(false);
          return;
        }

        if (result?.ok) {
          router.push(finalCallbackUrl);
          router.refresh();
        }
        return;
      }

      // If email provider is configured, use magic link flow
      if (authConfig.emailEnabled) {
        const result = await signIn("email", {
          email,
          callbackUrl: finalCallbackUrl,
          redirect: false,
        });

        if (result?.error) {
          if (isSignupMode) {
            setFormError("Account created but could not send sign-in email. Please try signing in again.");
          } else {
            setError(result.error);
          }
          setIsLoading(false);
          return;
        }

        // Redirect to verify-request page to tell user to check their email
        router.push("/auth/verify-request");
        return;
      }

      // Neither provider is available - show error
      setError("EmailNotConfigured");
      setIsLoading(false);
    } catch {
      setError("Default");
      setIsLoading(false);
    }
  };

  const displayError = formError 
    ? formError 
    : error 
      ? (errorMessages[error] || errorMessages.Default) 
      : null;

  const emailButtonText = authConfig.devBypassEnabled 
    ? (isSignupMode ? "Create Account (Dev)" : "Continue with Email (Dev)")
    : (isSignupMode ? "Create Account & Send Link" : "Send Sign-in Link");

  const emailHelperText = authConfig.devBypassEnabled
    ? null
    : "We'll send a secure sign-in link to your email.";

  return (
    <>
      {displayError && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {displayError}
        </div>
      )}

      <Card padding="lg">
        <CardContent className="space-y-6">
          <Button
            variant="outline"
            fullWidth
            size="lg"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-charcoal-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-charcoal-900 text-charcoal-500">
                or
              </span>
            </div>
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <Input
              type="email"
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {emailHelperText && (
              <p className="text-charcoal-500 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {emailHelperText}
              </p>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isLoading}
              disabled={!email || (!authConfig.emailEnabled && !authConfig.devBypassEnabled)}
            >
              {emailButtonText}
            </Button>

            {!authConfig.emailEnabled && !authConfig.devBypassEnabled && (
              <p className="text-charcoal-500 text-xs text-center">
                Email sign-in is not configured. Please use Google.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </>
  );
}

function SignInPageContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const role = searchParams.get("role");
  const dob = searchParams.get("dob");
  const isSignupMode = Boolean(role && dob);

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <span className="text-2xl font-bold text-primary-500">Paid</span>
          <span className="text-2xl font-bold text-gold-500">Talent</span>
        </div>
        <h1 className="text-xl font-semibold text-charcoal-100 mb-2">
          {isSignupMode ? "Create your account" : "Sign in to your account"}
        </h1>
        <p className="text-charcoal-400 text-sm">
          {isSignupMode
            ? `Creating ${role} account`
            : "Welcome back! Sign in to continue."}
        </p>
      </div>

      <Suspense fallback={
        <Card padding="lg">
          <CardContent className="space-y-6">
            <div className="h-12 bg-charcoal-700 rounded-lg animate-pulse" />
            <div className="h-12 bg-charcoal-700 rounded-lg animate-pulse" />
          </CardContent>
        </Card>
      }>
        <SignInForm />
      </Suspense>

      {!isSignupMode && (
        <p className="text-center text-charcoal-500 text-sm mt-6">
          Don&apos;t have an account?{" "}
          <a
            href="/auth/role-select"
            className="text-primary-400 hover:text-primary-300"
          >
            Get started
          </a>
        </p>
      )}
    </div>
  );
}

export default function SignInPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <span className="text-2xl font-bold text-primary-500">Paid</span>
              <span className="text-2xl font-bold text-gold-500">Talent</span>
            </div>
            <div className="h-8 bg-charcoal-700 rounded animate-pulse w-48 mx-auto" />
          </div>
          <Card padding="lg">
            <CardContent className="space-y-6">
              <div className="h-12 bg-charcoal-700 rounded-lg animate-pulse" />
              <div className="h-12 bg-charcoal-700 rounded-lg animate-pulse" />
            </CardContent>
          </Card>
        </div>
      }>
        <SignInPageContent />
      </Suspense>
    </div>
  );
}
