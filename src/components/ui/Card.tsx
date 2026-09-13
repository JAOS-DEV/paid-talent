"use client";

import React, { type ReactNode, type MouseEventHandler } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: MouseEventHandler<HTMLDivElement>;
}

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  children,
  className = "",
  hover = false,
  padding = "md",
  onClick,
}: CardProps): React.ReactElement {
  return (
    <div
      className={`
        bg-charcoal-900 border border-charcoal-700 rounded-xl
        w-full min-w-0 max-w-full overflow-hidden
        ${hover ? "hover:bg-charcoal-800 hover:border-charcoal-600 transition-colors cursor-pointer" : ""}
        ${paddingStyles[padding]}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({
  children,
  className = "",
}: CardHeaderProps): React.ReactElement {
  return (
    <div className={`border-b border-charcoal-700 pb-4 mb-4 ${className}`}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({
  children,
  className = "",
}: CardTitleProps): React.ReactElement {
  return (
    <h3 className={`text-lg font-semibold text-charcoal-100 ${className}`}>
      {children}
    </h3>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({
  children,
  className = "",
}: CardContentProps): React.ReactElement {
  return <div className={className}>{children}</div>;
}
