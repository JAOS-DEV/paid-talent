"use client";

import React from "react";

interface AccountVisibilityStripProps {
  label: string;
  email: string;
  className?: string;
}

function LockIcon(): React.ReactElement {
  return (
    <svg
      className="w-3.5 h-3.5 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

export function AccountVisibilityStrip({
  label,
  email,
  className = "",
}: AccountVisibilityStripProps): React.ReactElement {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-charcoal-800 bg-charcoal-900/60 px-3 py-2 text-xs text-charcoal-500 ${className}`}
      data-testid="account-visibility-strip"
    >
      <LockIcon />
      <p className="min-w-0 break-words">
        <span>{label}</span>
        <span aria-hidden="true">: </span>
        <span className="text-charcoal-400">{email}</span>
      </p>
    </div>
  );
}
