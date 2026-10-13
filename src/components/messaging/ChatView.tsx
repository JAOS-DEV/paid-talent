"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components/layout";
import { Button } from "@/components/ui";
import {
  ChatThread,
  MessageComposer,
  SafetyTip,
  ShareContactMenu,
} from "@/components/messaging";
import type { ConversationDetail } from "@/lib/conversations/service";
import type { ContactShareChannel } from "@/lib/db/schema";

interface ChatViewProps {
  conversationId: string;
  role: "worker" | "recruiter";
  listHref: string;
  profileSettingsHref: string;
}

export function ChatView({
  conversationId,
  role,
  listHref,
  profileSettingsHref,
}: ChatViewProps): React.ReactElement {
  const t = useTranslations("messaging");
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) {
        setError(t("errors.loadFailed"));
        return;
      }
      const data = await res.json();
      setConversation(data.conversation ?? null);
      setError(null);
    } catch {
      setError(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [conversationId, t]);

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

  const sendMessage = async (
    body: string
  ): Promise<{ code?: string; nudge?: string } | void> => {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { code: data.code, nudge: data.nudge };
    }
    await load();
  };

  const shareContact = async (
    channel: ContactShareChannel
  ): Promise<{ code?: string } | void> => {
    const res = await fetch(`/api/conversations/${conversationId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { code: data.code };
    }
    await load();
  };

  const hideChat = async (): Promise<void> => {
    await fetch(`/api/conversations/${conversationId}/hide`, {
      method: "POST",
    });
    router.push(listHref);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col bg-charcoal-950">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Link href={listHref} className="text-sm text-primary-400">
              {t("thread.back")}
            </Link>
            <Button type="button" variant="ghost" onClick={() => void hideChat()}>
              {t("thread.hide")}
            </Button>
          </div>
          {role === "worker" ? (
            <div className="mb-3">
              <SafetyTip variant="inline" />
            </div>
          ) : null}
          {loading ? (
            <p className="text-charcoal-400">{t("loading")}</p>
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : conversation ? (
            <>
              <h1 className="mb-3 text-lg font-semibold text-charcoal-100">
                {conversation.counterpart.displayName}
              </h1>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-charcoal-700 bg-charcoal-900">
                <ChatThread
                  messages={conversation.messages}
                  showSafetyBanner={
                    role === "worker" && conversation.safetyNotice
                  }
                />
                <div className="flex items-end justify-between gap-2 border-t border-charcoal-700 p-2">
                  <ShareContactMenu
                    channels={conversation.shareChannels}
                    counterpartName={conversation.counterpart.displayName}
                    profileSettingsHref={profileSettingsHref}
                    onShare={shareContact}
                    disabled={conversation.status !== "open"}
                  />
                </div>
                <MessageComposer
                  maxChars={conversation.messageMaxChars}
                  onSend={sendMessage}
                  disabled={conversation.status !== "open"}
                />
              </div>
              <p className="mt-2 text-xs text-charcoal-500">{t("thread.hideNote")}</p>
            </>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}
