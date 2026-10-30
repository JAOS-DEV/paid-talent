"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";

interface MessageComposerProps {
  maxChars: number;
  onSend: (body: string) => Promise<{ code?: string; nudge?: string } | void>;
  disabled?: boolean;
}

export function MessageComposer({
  maxChars,
  onSend,
  disabled = false,
}: MessageComposerProps): React.ReactElement {
  const t = useTranslations("messaging");
  const [text, setText] = useState("");
  const [shareTip, setShareTip] = useState(false);
  const [busy, setBusy] = useState(false);

  const remaining = maxChars - text.length;

  const submit = async (): Promise<void> => {
    const body = text.trim();
    if (!body || busy || disabled) return;
    setBusy(true);
    setShareTip(false);
    try {
      const result = await onSend(body);
      if (result?.code === "contact_info_blocked") {
        setShareTip(true);
        return;
      }
      setText("");
      if (result?.nudge === "use_share_button") {
        setShareTip(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="space-y-2 border-t border-charcoal-700 bg-charcoal-900 p-3">
      {shareTip ? (
        <p className="text-sm text-amber-300" role="status" data-testid="share-tip">
          {t("composer.shareTip")}
        </p>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, maxChars))}
        onKeyDown={onKeyDown}
        rows={3}
        disabled={disabled || busy}
        className="w-full resize-none rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-charcoal-100"
        placeholder={t("composer.placeholder")}
        aria-label={t("composer.placeholder")}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-charcoal-300">
          {t("composer.counter", { remaining })}
        </span>
        <Button
          type="button"
          variant="primary"
          disabled={disabled || busy || !text.trim()}
          onClick={() => void submit()}
        >
          {busy ? t("composer.sending") : t("composer.send")}
        </Button>
      </div>
    </div>
  );
}
