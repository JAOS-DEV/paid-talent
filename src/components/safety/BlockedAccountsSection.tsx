"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";

interface BlockedAccount {
  id: string;
  name: string | null;
  blockedAt: string;
}

export function BlockedAccountsSection(): React.ReactElement {
  const t = useTranslations("safety.blocks");
  const [blocks, setBlocks] = useState<BlockedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/blocks");
      if (!res.ok) {
        setError(t("loadFailed"));
        return;
      }
      const data = await res.json();
      setBlocks(data.blocks ?? []);
      setError(null);
    } catch {
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = async (blockId: string): Promise<void> => {
    setBusyId(blockId);
    try {
      const res = await fetch("/api/blocks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId }),
      });
      if (!res.ok) {
        setError(t("unblockFailed"));
        return;
      }
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    } catch {
      setError(t("unblockFailed"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3" data-testid="blocked-accounts">
      <h2 className="text-lg font-semibold text-charcoal-100">{t("title")}</h2>
      <p className="text-sm text-charcoal-400">{t("description")}</p>
      {loading ? (
        <p className="text-sm text-charcoal-500">{t("loading")}</p>
      ) : error ? (
        <p className="text-sm text-error">{error}</p>
      ) : blocks.length === 0 ? (
        <p className="text-sm text-charcoal-500">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {blocks.map((block) => (
            <li
              key={block.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2"
            >
              <span className="text-sm text-charcoal-100">
                {block.name || t("unknownName")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busyId === block.id}
                onClick={() => void unblock(block.id)}
              >
                {t("unblock")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
