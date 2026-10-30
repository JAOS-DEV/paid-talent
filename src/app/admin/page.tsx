import React from "react";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { getAdminOverviewMetrics } from "@/lib/admin/overview-metrics";
import { listRecentAdminAuditEvents } from "@/lib/admin/activity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { labelForToken } from "@/lib/admin/token-labels";

function MetricCard(props: {
  title: string;
  value: string | number;
  hint: string;
  href?: string;
}): React.ReactElement {
  const card = (
    <Card
      padding="lg"
      className={`h-full ${props.href ? "transition-colors group-hover:border-primary-600/40" : ""}`}
    >
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-primary-300">{props.value}</p>
        <p className="text-sm text-charcoal-400 mt-2">{props.hint}</p>
      </CardContent>
    </Card>
  );

  if (!props.href) {
    return card;
  }

  return (
    <Link href={props.href} prefetch={false} className="block group">
      {card}
    </Link>
  );
}

export default async function AdminDashboardPage(): Promise<React.ReactElement> {
  await requireAdminPage("/admin");
  const [metrics, activity] = await Promise.all([
    getAdminOverviewMetrics(),
    listRecentAdminAuditEvents(8),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Admin overview</h1>
        <p className="text-charcoal-400 mt-1">
          Operational snapshot of accounts, moderation, and premium access.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Total users" value={metrics.totalUsers} hint="All Talent and Venue accounts" href="/admin/users" />
        <MetricCard title="Talent" value={metrics.workers} hint="Talent accounts" href="/admin/users" />
        <MetricCard title="Venues" value={metrics.recruiters} hint="Venue accounts" href="/admin/users" />
        <MetricCard title="New users (7 days)" value={metrics.newUsersLast7Days} hint="Accounts created in the last 7 days" />
        <MetricCard title="New users (30 days)" value={metrics.newUsersLast30Days} hint="Accounts created in the last 30 days" />
        <MetricCard title="Published talent" value={metrics.publishedWorkers} hint="Talent currently visible in search" />
        <MetricCard title="Published openings" value={metrics.publishedOpenings} hint="Active venue openings" />
        <MetricCard
          title="Identity verification"
          value={metrics.pendingVerifications}
          hint="Pending talent identity reviews"
          href="/admin/verifications"
        />
        <MetricCard
          title="Venue reviews"
          value={metrics.pendingVenues}
          hint="Venue links awaiting approval"
          href="/admin/venues"
        />
        <MetricCard
          title="Photo moderation"
          value={metrics.pendingPhotos}
          hint="Quarantined photos awaiting review"
          href="/admin/photos"
        />
        <MetricCard
          title="Open reports"
          value={metrics.openReports}
          hint="User safety reports awaiting triage"
          href="/admin/reports"
        />
        <MetricCard
          title="Open flags"
          value={metrics.openFlags}
          hint="Automated message flags awaiting review"
          href="/admin/flags"
        />
        <MetricCard title="Paid premium accounts" value={metrics.paidPremiumAccounts} hint="Active or trialing Stripe Top Talent plans" />
        <MetricCard title="Admin-granted premium" value={metrics.adminGrantedPremiumAccounts} hint="Accounts with a current admin entitlement" />
        <MetricCard title="Lifetime grants" value={metrics.lifetimeGrants} hint="Unrevoked no-expiry admin grants" />
        <MetricCard
          title="Subscription paywall"
          value={metrics.billingAccessModeLabel}
          hint={
            metrics.billingAccessMode === "open_access"
              ? "Premium features are temporarily available without payment"
              : "Paid or admin entitlement required"
          }
          href="/admin/settings"
        />
        <MetricCard
          title="Top Talent"
          value={metrics.topTalentCount}
          hint="Published talent currently meeting Top Talent ranking"
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-charcoal-100">Recent activity</h2>
          <Link href="/admin/activity" prefetch={false} className="text-sm text-primary-300 hover:text-primary-200">
            View all
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-charcoal-300">No admin actions recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {activity.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-charcoal-800 bg-charcoal-900 px-4 py-3 text-sm"
              >
                <p className="text-charcoal-100">{labelForToken(event.action)}</p>
                <p className="text-charcoal-300 mt-1">
                  {event.actorAdminEmail}
                  {event.targetIdentity ? ` → ${event.targetIdentity}` : ""}
                  {" · "}
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
