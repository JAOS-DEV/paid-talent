"use client";

import React, { type ReactNode } from "react";

type BadgeVariant = "default" | "primary" | "gold" | "success" | "warning" | "error";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-charcoal-700 text-charcoal-200",
  primary: "bg-primary-600/20 text-primary-300 border border-primary-600/30",
  gold: "bg-gold-500/20 text-gold-400 border border-gold-500/30",
  success: "bg-green-500/20 text-green-400 border border-green-500/30",
  warning: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  error: "bg-red-500/20 text-red-400 border border-red-500/30",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps): React.ReactElement {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5
        rounded-full text-xs font-medium
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

export function TopTalentBadge({ className = "" }: { className?: string }): React.ReactElement {
  return (
    <Badge variant="gold" className={className}>
      <svg
        className="w-3 h-3 mr-1"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      Top Talent
    </Badge>
  );
}
