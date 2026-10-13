"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import type { ConversationListItem } from "@/lib/conversations/service";

interface ConversationListProps {
  items: ConversationListItem[];
  basePath: "/worker/messages" | "/recruiter/messages";
}

export function ConversationList({
  items,
  basePath,
}: ConversationListProps): React.ReactElement {
  const t = useTranslations("messaging");

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-6 text-charcoal-400">
        {t("list.empty")}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`${basePath}/${item.id}`}
            className="flex items-center gap-3 rounded-xl border border-charcoal-700 bg-charcoal-900 p-4 hover:border-charcoal-600"
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-charcoal-800">
              {item.counterpart.photoUrl ? (
                <Image
                  src={item.counterpart.photoUrl}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-charcoal-100">
                  {item.counterpart.displayName}
                </span>
                {item.counterpart.verifiedPro ? (
                  <Badge variant="gold">{t("list.verifiedPro")}</Badge>
                ) : null}
                {item.unread ? (
                  <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                ) : null}
              </div>
              {item.lastMessagePreview ? (
                <p className="truncate text-sm text-charcoal-400">
                  {item.lastMessagePreview}
                </p>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
