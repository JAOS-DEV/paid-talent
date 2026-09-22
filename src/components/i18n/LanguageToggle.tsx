"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useLocale } from "@/lib/i18n/useLocale";
import type { Locale } from "@/lib/i18n/config";

const SHORT_LABEL: Record<Locale, string> = {
  en: "EN",
  th: "ไทย",
};

interface MenuPosition {
  top: number;
  left: number;
}

function GlobeIcon(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M3 12h18" />
      <path
        strokeLinecap="round"
        d="M12 3c2.5 2.8 3.8 5.8 3.8 9s-1.3 6.2-3.8 9c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3z"
      />
    </svg>
  );
}

function CheckIcon(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 text-primary-300"
      fill="currentColor"
      aria-hidden="true"
      data-testid="locale-active-check"
    >
      <path d="M6.2 11.4 2.8 8l1.2-1.2 2.2 2.2 5-5L12.4 5.2z" />
    </svg>
  );
}

export function LanguageToggle(): React.ReactElement {
  const t = useTranslations("language");
  const { locale, locales, switchLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shouldFocusMenu = useRef(false);
  const menuId = useId();

  const closeMenu = (): void => {
    setOpen(false);
  };

  const toggleMenu = (): void => {
    setOpen((current) => {
      const next = !current;
      if (next) {
        shouldFocusMenu.current = true;
      }
      return next;
    });
  };

  const handleSelect = (nextLocale: Locale): void => {
    closeMenu();
    if (nextLocale === locale || pendingLocale) {
      return;
    }
    setPendingLocale(nextLocale);
    void switchLocale(nextLocale).finally(() => {
      setPendingLocale(null);
    });
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const place = (): void => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      setPosition({ top: rect.bottom + 4, left: rect.right });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !position || !shouldFocusMenu.current) {
      return;
    }
    shouldFocusMenu.current = false;
    const index = locales.indexOf(locale);
    itemRefs.current[index]?.focus();
  }, [open, position, locale, locales]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const items = itemRefs.current.filter(
      (item): item is HTMLButtonElement => item !== null
    );
    const current = items.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = current < 0 ? 0 : (current + 1) % items.length;
      items[next]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = current <= 0 ? items.length - 1 : current - 1;
      items[next]?.focus();
    }
  };

  const menu =
    open && position
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={t("label")}
            onKeyDown={handleMenuKeyDown}
            style={{ top: position.top, left: position.left }}
            className="fixed z-50 min-w-36 -translate-x-full rounded-lg border border-charcoal-600 bg-charcoal-800 py-1 shadow-lg"
          >
            {locales.map((code, index) => {
              const selected = locale === code;
              return (
                <button
                  key={code}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  disabled={pendingLocale !== null}
                  onClick={() => handleSelect(code)}
                  className="flex h-8 w-full items-center justify-between gap-3 px-3 text-left text-sm font-semibold text-charcoal-100 hover:bg-charcoal-700 focus:outline-none focus-visible:bg-charcoal-700 disabled:opacity-50"
                >
                  <span>{SHORT_LABEL[code]}</span>
                  {selected ? <CheckIcon /> : <span className="h-4 w-4" aria-hidden="true" />}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-charcoal-300 hover:bg-charcoal-800 hover:text-charcoal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
        aria-label={t("label")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={pendingLocale !== null}
        onClick={toggleMenu}
      >
        <GlobeIcon />
      </button>
      {menu}
    </div>
  );
}
