"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components/layout";
import { ConversationList } from "@/components/messaging";
import type { ConversationListItem } from "@/lib/conversations/service";

interface MessagesInboxProps {
  basePath: "/worker/messages" | "/recruiter/messages";
}

export function MessagesInbox({
  basePath,
}: MessagesInboxProps): React.ReactElement {
  const t = useTranslations("messaging");
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setItems(data.conversations ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 10_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [load]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-charcoal-950 py-8">
        <div
          className={`mx-auto space-y-4 px-4 sm:px-6 lg:px-8 ${
            basePath === "/recruiter/messages" ? "max-w-7xl" : "max-w-3xl"
          }`}
        >
          <div>
            <h1 className="text-2xl font-bold text-charcoal-100">
              {t("list.title")}
            </h1>
            <p className="mt-1 text-charcoal-400">{t("list.subtitle")}</p>
          </div>
          {loading ? (
            <p className="text-charcoal-400">{t("loading")}</p>
          ) : (
            <ConversationList items={items} basePath={basePath} />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
