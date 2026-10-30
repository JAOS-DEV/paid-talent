"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent } from "@/components/ui";
import { AuthLocaleBar } from "@/components/i18n";
import { BrandMark } from "@/components/layout/BrandMark";

export default function SignOutPage(): React.ReactElement {
  const t = useTranslations("signOutPage");
  const [busy, setBusy] = useState(false);

  const confirmSignOut = (): void => {
    setBusy(true);
    void signOut({ callbackUrl: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal-950 p-4">
      <AuthLocaleBar />
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandMark href="/" />
        </div>
        <Card padding="lg">
          <CardContent className="space-y-4">
            <h1 className="text-xl font-semibold text-charcoal-100">{t("title")}</h1>
            <p className="text-sm text-charcoal-200">{t("body")}</p>
            <Button
              type="button"
              variant="destructive"
              fullWidth
              loading={busy}
              onClick={confirmSignOut}
            >
              {t("confirm")}
            </Button>
            <Link href="/" className="block">
              <Button type="button" variant="secondary" fullWidth disabled={busy}>
                {t("cancel")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
