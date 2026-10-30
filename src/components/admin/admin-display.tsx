"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui";
import {
  labelForToken,
  statusPillVariant,
} from "@/lib/admin/token-labels";

export function AdminStatusPill({
  status,
}: {
  status: string | null | undefined;
}): React.ReactElement {
  return (
    <Badge variant={statusPillVariant(status)}>{labelForToken(status)}</Badge>
  );
}

export function ShortId({ id }: { id: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const short = id.slice(0, 8);

  const copy = (): void => {
    void navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs text-charcoal-200">
      <span>{short}</span>
      <button
        type="button"
        onClick={copy}
        className="min-h-11 rounded-md px-2 text-xs font-sans text-primary-300 hover:bg-charcoal-800"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

export { labelForToken };
