"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components/layout";
import { OverflowMenu } from "@/components/ui";
import {
  ChatThread,
  MessageComposer,
  SafetyTip,
  ShareContactMenu,
} from "@/components/messaging";
import { ReportDialog } from "@/components/safety";
import { BlockAlertDialog } from "@/components/safety/BlockAlertDialog";
import type { ConversationDetail } from "@/lib/conversations/service";
import type { ContactShareChannel } from "@/lib/db/schema";

interface ChatViewProps {
  conversationId: string;
  role: "worker" | "recruiter";
  listHref: string;
  profileSettingsHref: string;
  contentClassName?: string;
}

export function ChatView({
  conversationId,
  role,
  listHref,
  profileSettingsHref,
  contentClassName = "max-w-3xl",
}: ChatViewProps): React.ReactElement {
  const t = useTranslations("messaging");
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
    if (data.nudge) {
      return { nudge: data.nudge };
    }
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

  const blockUser = async (): Promise<void> => {
    setBlockBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok) {
        setToast(t("errors.blockFailed"));
        return;
      }
      setBlockOpen(false);
      router.push(listHref);
    } catch {
      setToast(t("errors.blockFailed"));
    } finally {
      setBlockBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col bg-charcoal-950">
        <div
          className={`mx-auto flex w-full flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8 ${contentClassName}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <Link href={listHref} className="text-sm text-primary-400">
              {t("thread.back")}
            </Link>
            <OverflowMenu
              label={t("thread.more")}
              items={[
                {
                  id: "report",
                  label: t("thread.report"),
                  onSelect: () => setReportOpen(true),
                },
                {
                  id: "block",
                  label: t("thread.block"),
                  onSelect: () => setBlockOpen(true),
                },
                {
                  id: "hide",
                  label: t("thread.hide"),
                  onSelect: () => void hideChat(),
                },
              ]}
            />
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
              {conversation.hiddenFromInbox ? (
                <p className="mt-2 text-xs text-charcoal-300">{t("thread.hideNote")}</p>
              ) : null}
              <ReportDialog
                open={reportOpen}
                onClose={() => setReportOpen(false)}
                conversationId={conversationId}
                contactRequestId={conversation.contactRequestId}
              />
            </>
          ) : null}
        </div>
      </main>
      <BlockAlertDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        busy={blockBusy}
        onConfirm={() => void blockUser()}
      />
      <Footer />
      {toast ? (
        <div
          role="status"
          data-testid="error-toast"
          className="fixed bottom-4 left-1/2 z-50 w-[min(100%-2rem,24rem)] -translate-x-1/2 rounded-lg border border-error/40 bg-charcoal-900 px-4 py-3 text-sm text-error shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
