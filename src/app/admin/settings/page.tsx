import React from "react";
import { requireAdminPage } from "@/lib/admin/guard";
import { getPlatformBillingSettings } from "@/lib/platform-settings";
import { getMessagingSettings } from "@/lib/messaging/settings";
import { BillingSettingsPanel } from "@/components/admin/BillingSettingsPanel";
import { BillingPricesPanel } from "@/components/admin/BillingPricesPanel";
import { MessagingSettingsPanel } from "@/components/admin/MessagingSettingsPanel";

export default async function AdminSettingsPage(): Promise<React.ReactElement> {
  await requireAdminPage("/admin/settings");
  const [settings, messaging] = await Promise.all([
    getPlatformBillingSettings(),
    getMessagingSettings(),
  ]);

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
      <BillingPricesPanel />
      <MessagingSettingsPanel
        settings={{
          freeDailyNew: messaging.freeDailyNew,
          freeWeeklyNew: messaging.freeWeeklyNew,
          freePendingMax: messaging.freePendingMax,
          freeOpenerMaxChars: messaging.freeOpenerMaxChars,
          freeCanAttachOpening: messaging.freeCanAttachOpening,
          freeMaxVenues: messaging.freeMaxVenues,
          paidDailyNew: messaging.paidDailyNew,
          paidWeeklyNew: messaging.paidWeeklyNew,
          paidDailyTopTalent: messaging.paidDailyTopTalent,
          paidPendingMax: messaging.paidPendingMax,
          paidOpenerMaxChars: messaging.paidOpenerMaxChars,
          paidMaxVenues: messaging.paidMaxVenues,
          newRecruiterDailyCap: messaging.newRecruiterDailyCap,
          newRecruiterWindowDays: messaging.newRecruiterWindowDays,
          workerInboundDailyDefault: messaging.workerInboundDailyDefault,
          followUpAfterHours: messaging.followUpAfterHours,
          requestExpiryDays: messaging.requestExpiryDays,
          declineCooldownDays: messaging.declineCooldownDays,
          messageMaxChars: messaging.messageMaxChars,
          autoPauseReportThreshold: messaging.autoPauseReportThreshold,
          autoPauseWindowDays: messaging.autoPauseWindowDays,
          notifyCooldownMinutes: messaging.notifyCooldownMinutes,
          lineMonthlyPushBudget: messaging.lineMonthlyPushBudget,
          retentionDays: messaging.retentionDays,
          updatedAt: messaging.updatedAt.toISOString(),
          updatedBy: messaging.updatedBy,
        }}
      />
    </div>
  );
}
