"use client";

import React from "react";
import Link from "next/link";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({
  error,
  reset,
}: GlobalErrorProps): React.ReactElement {
  return (
    <html lang="en">
      <body className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
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
            Something went wrong
          </h1>
          <p className="text-charcoal-400 mb-6">
            {error?.message || "An unexpected error occurred"}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => reset()}
              className="w-full px-4 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="block w-full px-4 py-3 border border-charcoal-700 text-charcoal-300 rounded-lg font-medium hover:bg-charcoal-800 transition-colors text-center"
            >
              Return Home
            </Link>
          </div>
          {error?.digest && (
            <p className="mt-4 text-xs text-charcoal-600">
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
