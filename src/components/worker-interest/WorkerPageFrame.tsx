import React, { type ReactNode } from "react";
import Link from "next/link";
import { Footer, Header } from "@/components/layout";

interface WorkerPageFrameProps {
  backHref: string;
  backLabel: string;
  title: string;
  children: ReactNode;
}

export function WorkerPageFrame({
  backHref,
  backLabel,
  title,
  children,
}: WorkerPageFrameProps): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col bg-charcoal-950">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8 overflow-x-hidden">
        <div className="max-w-2xl mx-auto px-4 w-full min-w-0">
          <Link
            href={backHref}
            className="inline-flex items-center min-h-11 max-w-full text-sm text-charcoal-400 hover:text-charcoal-200"
          >
            {backLabel}
          </Link>
          <h1 className="text-2xl font-semibold text-white mt-2 mb-6 break-words">
            {title}
          </h1>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
