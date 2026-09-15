import React from "react";
import Link from "next/link";

interface RecruiterBackLinkProps {
  href: string;
  children: React.ReactNode;
}

export function RecruiterBackLink({
  href,
  children,
}: RecruiterBackLinkProps): React.ReactElement {
  return (
    <Link
      href={href}
      className="inline-flex items-center min-h-11 max-w-full text-sm text-primary-400 hover:text-primary-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
    >
      {children}
    </Link>
  );
}
