"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface NotificationItem {
  id: string;
  type: string;
  subject: string;
  text: string;
  url: string;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsBell(): React.ReactElement {
  const t = useTranslations("notifications");
  const tNav = useTranslations("navigation");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setUnread(Number(data.unreadCount ?? 0));
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
    } catch {
      // keep last known state
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
    }, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const markAllRead = async (): Promise<void> => {
    setLoading(true);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await load();
    } finally {
      setLoading(false);
    }
  };

  const markOneRead = async (id: string): Promise<void> => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    await load();
  };

  const label =
    unread > 0
      ? tNav("notificationsUnread", { count: unread })
      : tNav("notifications");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) void load();
        }}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-charcoal-200 hover:bg-charcoal-800"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-5 w-5 fill-none stroke-current"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-semibold text-charcoal-950">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-1.5rem,22rem)] rounded-xl border border-charcoal-700 bg-charcoal-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-charcoal-700 px-3 py-2">
            <p className="text-sm font-semibold text-charcoal-100">
              {t("bellLabel")}
            </p>
            <button
              type="button"
              disabled={loading || unread === 0}
              onClick={() => void markAllRead()}
              className="text-xs text-gold-400 disabled:opacity-40"
            >
              {t("markAllRead")}
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-charcoal-400">
                {t("empty")}
              </li>
            ) : (
              items.map((item) => (
                <li key={item.id} className="border-b border-charcoal-800 last:border-0">
                  <Link
                    href={item.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                    onClick={() => {
                      setOpen(false);
                      if (!item.readAt) void markOneRead(item.id);
                    }}
                    className={`block px-3 py-2.5 hover:bg-charcoal-800 ${
                      item.readAt ? "opacity-70" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-charcoal-100">
                      {item.subject}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-charcoal-400">
                      {item.text}
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-charcoal-700 px-3 py-2">
            <Link
              href="/settings/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-gold-400 hover:text-gold-300"
            >
              {t("viewSettings")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
