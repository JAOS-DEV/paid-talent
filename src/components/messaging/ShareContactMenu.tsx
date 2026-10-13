"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import type { ContactShareChannel } from "@/lib/db/schema";

interface ShareContactMenuProps {
  channels: ContactShareChannel[];
  counterpartName: string;
  profileSettingsHref: string;
  onShare: (channel: ContactShareChannel) => Promise<{ code?: string } | void>;
  disabled?: boolean;
}

const CHANNEL_LABEL_KEY: Record<
  ContactShareChannel,
  "shareLine" | "sharePhone" | "shareWhatsapp"
> = {
  line: "shareLine",
  phone: "sharePhone",
  whatsapp: "shareWhatsapp",
};

export function ShareContactMenu({
  channels,
  counterpartName,
  profileSettingsHref,
  onShare,
  disabled = false,
}: ShareContactMenuProps): React.ReactElement | null {
  const t = useTranslations("messaging");
  const [open, setOpen] = useState(false);
  const [pendingChannel, setPendingChannel] =
    useState<ContactShareChannel | null>(null);
  const [busy, setBusy] = useState(false);
  const [noValue, setNoValue] = useState(false);

  if (channels.length === 0) {
    return null;
  }

  const runShare = async (channel: ContactShareChannel): Promise<void> => {
    setBusy(true);
    setNoValue(false);
    try {
      const result = await onShare(channel);
      if (result?.code === "no_value") {
        setNoValue(true);
        return;
      }
      setPendingChannel(null);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {t("share.menu")}
      </Button>
      {open ? (
        <div className="absolute bottom-full right-0 z-10 mb-2 w-56 rounded-lg border border-charcoal-600 bg-charcoal-900 p-2 shadow-lg">
          {pendingChannel ? (
            <div className="space-y-2 p-1">
              <p className="text-sm text-charcoal-200">
                {t("share.confirm", {
                  channel: t(`share.${CHANNEL_LABEL_KEY[pendingChannel]}`),
                  name: counterpartName,
                })}
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="primary"
                  fullWidth
                  disabled={busy}
                  onClick={() => void runShare(pendingChannel)}
                >
                  {t("share.confirmAction")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  disabled={busy}
                  onClick={() => setPendingChannel(null)}
                >
                  {t("share.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {channels.map((channel) => (
                <li key={channel}>
                  <button
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-charcoal-100 hover:bg-charcoal-800"
                    onClick={() => {
                      setNoValue(false);
                      setPendingChannel(channel);
                    }}
                  >
                    {t(`share.${CHANNEL_LABEL_KEY[channel]}`)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {noValue ? (
            <p className="mt-2 text-xs text-red-400">
              {t("share.noValue")}{" "}
              <Link href={profileSettingsHref} className="underline">
                {t("share.profileSettings")}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
