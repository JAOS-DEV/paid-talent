"use client";

import React, { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import type { MessageDto } from "@/lib/conversations/service";

interface ChatThreadProps {
  messages: MessageDto[];
  showSafetyBanner: boolean;
}

function ContactShareCard({ body }: { body: string }): React.ReactElement {
  const t = useTranslations("messaging");
  const value = body.includes(":") ? body.split(":").slice(1).join(":").trim() : body;

  const copy = (): void => {
    void navigator.clipboard.writeText(value);
  };

  return (
    <div
      className="rounded-lg border border-primary-500/40 bg-primary-500/10 px-3 py-2 text-sm text-charcoal-100"
      data-testid="contact-share-card"
    >
      <p className="font-medium">{body}</p>
      <Button type="button" variant="ghost" className="mt-2" onClick={copy}>
        {t("thread.copyContact")}
      </Button>
    </div>
  );
}

export function ChatThread({
  messages,
  showSafetyBanner,
}: ChatThreadProps): React.ReactElement {
  const t = useTranslations("messaging");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
      {showSafetyBanner ? (
        <p
          className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
          data-testid="safety-banner"
        >
          {t("safety.banner")}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {messages.map((message) => (
          <li
            key={message.id}
            className={`flex ${message.isMine ? "justify-end" : "justify-start"}`}
          >
            {message.kind === "contact_share" ? (
              <ContactShareCard body={message.body} />
            ) : (
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  message.isMine
                    ? "bg-primary-600 text-white"
                    : "bg-charcoal-800 text-charcoal-100"
                }`}
              >
                {message.body}
              </p>
            )}
          </li>
        ))}
      </ul>
      <div ref={bottomRef} />
    </div>
  );
}
