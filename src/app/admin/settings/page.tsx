import React from "react";
import { requireAdminPage } from "@/lib/admin/guard";
import { getPlatformBillingSettings } from "@/lib/platform-settings";
import { BillingSettingsPanel } from "@/components/admin/BillingSettingsPanel";

export default async function AdminSettingsPage(): Promise<React.ReactElement> {
  await requireAdminPage("/admin/settings");
  const settings = await getPlatformBillingSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Settings</h1>
        <p className="text-charcoal-400 mt-1">
          Runtime platform controls. Changes take effect without a redeploy.
        </p>
      </div>
      <BillingSettingsPanel
        mode={settings.mode}
        reason={settings.reason}
        updatedAt={settings.updatedAt?.toISOString() ?? null}
        updatedBy={settings.updatedBy}
      />
    </div>
  );
}
