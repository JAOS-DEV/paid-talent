"use client";

import React, { useState } from "react";
import { Button, Textarea } from "@/components/ui";

interface ConversationViewGateProps {
  conversationId: string;
}

interface ViewData {
  conversation: {
    id: string;
    status: string;
    createdAt: string;
    legalHoldUntil: string | null;
  };
  request: {
    id: string;
    openerText: string;
    followUpText: string | null;
    status: string;
    createdAt: string;
    venueName: string | null;
  } | null;
  messages: Array<{
    id: string;
    senderRole: string;
    kind: string;
    body: string;
    createdAt: string;
  }>;
  shares: Array<{
    id: string;
    channel: string;
    createdAt: string;
  }>;
  participants: {
    worker: { userId: string; name: string | null };
    recruiter: { userId: string; name: string | null };
  };
}

export function ConversationViewGate({
  conversationId,
}: ConversationViewGateProps): React.ReactElement {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ViewData | null>(null);

  const load = async (): Promise<void> => {
    if (reason.trim().length < 5) {
      setError("Enter a reason of at least 5 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/conversations/${conversationId}?reason=${encodeURIComponent(reason.trim())}`
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Unable to open conversation");
        return;
      }
      setData(json as ViewData);
    } catch {
      setError("Unable to open conversation");
    } finally {
      setBusy(false);
    }
  };

  if (data) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-charcoal-800 bg-charcoal-900 p-4 text-sm text-charcoal-300 space-y-1">
          <p>Status: {data.conversation.status}</p>
          <p>
            Worker: {data.participants.worker.name || data.participants.worker.userId}
          </p>
          <p>
            Recruiter:{" "}
            {data.participants.recruiter.name ||
              data.participants.recruiter.userId}
          </p>
          {data.conversation.legalHoldUntil ? (
            <p>Legal hold until: {data.conversation.legalHoldUntil}</p>
          ) : null}
        </div>

        {data.request ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-charcoal-100">
              Contact request
            </h2>
            <p className="text-sm text-charcoal-400">
              Venue: {data.request.venueName ?? "—"} · {data.request.status}
            </p>
            <p className="whitespace-pre-wrap text-sm text-charcoal-200">
              {data.request.openerText}
            </p>
            {data.request.followUpText ? (
              <p className="whitespace-pre-wrap text-sm text-charcoal-300 border-l-2 border-charcoal-600 pl-3">
                {data.request.followUpText}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-charcoal-100">Messages</h2>
          <ul className="space-y-2">
            {data.messages.map((msg) => (
              <li
                key={msg.id}
                className="rounded-lg border border-charcoal-800 bg-charcoal-900 px-3 py-2"
              >
                <p className="text-xs text-charcoal-500">
                  {msg.senderRole} · {msg.kind} ·{" "}
                  {new Date(msg.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-charcoal-100">
                  {msg.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {data.shares.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-charcoal-100">
              Contact shares
            </h2>
            <ul className="text-sm text-charcoal-300 space-y-1">
              {data.shares.map((share) => (
                <li key={share.id}>
                  {share.channel} · {new Date(share.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-4 rounded-xl border border-charcoal-800 bg-charcoal-900 p-5">
      <p className="text-sm text-charcoal-400">
        Viewing a conversation is audited. Enter why you need access (min 5
        characters). Only reported or flagged threads can be opened.
      </p>
      <Textarea
        label="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        minLength={5}
        required
      />
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <Button
        type="button"
        variant="primary"
        fullWidth
        loading={busy}
        disabled={reason.trim().length < 5 || busy}
        onClick={() => void load()}
      >
        Open conversation
      </Button>
    </div>
  );
}
