import React from "react";

export default function AdminLoading(): React.ReactElement {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-charcoal-800 animate-pulse" />
        <div className="h-4 w-72 max-w-full rounded bg-charcoal-900 animate-pulse" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-28 rounded-xl border border-charcoal-800 bg-charcoal-900 animate-pulse"
          />
        ))}
      </div>
      <span className="sr-only">Loading admin page</span>
    </div>
  );
}
