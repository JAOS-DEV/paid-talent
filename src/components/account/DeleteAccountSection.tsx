"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ACCOUNT_DELETION_CONFIRM_PHRASE } from "@/lib/account/constants";

export function DeleteAccountSection(): React.ReactElement {
  const t = useTranslations("accountDeletion");
  const [phrase, setPhrase] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPhrase: phrase }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || t("failed"));
        return;
      }
      await signOut({ callbackUrl: "/" });
    } catch {
      setError(t("failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-charcoal-400">{t("body")}</p>
        {open ? (
          <div className="space-y-3">
            <label className="block text-sm text-charcoal-300" htmlFor="delete-account-phrase">
              {t("confirmLabel", { phrase: ACCOUNT_DELETION_CONFIRM_PHRASE })}
            </label>
            <input
              id="delete-account-phrase"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-charcoal-600 bg-charcoal-900 px-3 py-3 text-sm text-charcoal-100"
            />
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                disabled={busy || phrase.trim() !== ACCOUNT_DELETION_CONFIRM_PHRASE}
                onClick={() => {
                  void submit();
                }}
              >
                {busy ? t("working") : t("confirmButton")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  setPhrase("");
                  setError(null);
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
            {t("title")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
