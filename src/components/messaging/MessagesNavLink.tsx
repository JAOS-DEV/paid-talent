"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface MessagesNavLinkProps {
  href: string;
}

export function MessagesNavLink({ href }: MessagesNavLinkProps): React.ReactElement {
  const t = useTranslations("navigation");
  const [unread, setUnread] = useState(0);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setUnread(Number(data.unreadCount ?? 0));
      }
    } catch {
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    void load();
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

  const label =
    unread > 0 ? t("messagesUnread", { count: unread }) : t("messages");

  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-2 text-xs font-medium text-charcoal-200 hover:bg-charcoal-800 sm:px-2.5 sm:text-sm"
    >
      {label}
    </Link>
  );
}
