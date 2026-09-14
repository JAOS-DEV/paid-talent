import React from "react";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/guard";
import { getAdminUserDetail } from "@/lib/admin/users";
import { listAdminAuditEventsForUser } from "@/lib/admin/activity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { UserModerationPanel } from "@/components/admin/UserModerationPanel";
import { UserEntitlementPanel } from "@/components/admin/UserEntitlementPanel";
import { auth } from "@/lib/auth";

interface AdminUserDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps): Promise<React.ReactElement> {
  await requireAdminPage("/admin/users");
  const { id } = await params;
  const session = await auth();
  const detail = await getAdminUserDetail(id);

  if (!detail) {
    notFound();
  }

  const activity = await listAdminAuditEventsForUser(detail.user.id);
  const isSelf = session?.user?.id === detail.user.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">
          {detail.user.name || detail.user.email}
        </h1>
        <p className="text-charcoal-400 mt-1">{detail.user.email}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-charcoal-300">
            <p>User id: {detail.user.id}</p>
            <p className="capitalize">Role: {detail.user.role}</p>
            <p>Age verification: {detail.user.ageVerified ? "Verified" : "Unverified"}</p>
            <p className="capitalize">Status: {detail.user.accountStatus}</p>
            <p>Created: {new Date(detail.user.createdAt).toLocaleString()}</p>
          </CardContent>
        </Card>

        {detail.worker && (
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Worker profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-charcoal-300">
              <p>Display name: {detail.worker.displayName}</p>
              <p>Published: {detail.worker.publicationStatus ? "Yes" : "No"}</p>
              <p className="capitalize">
                Identity verification: {detail.worker.identityVerificationStatus}
              </p>
              <p>
                Photos: {detail.worker.photoCounts.approved} approved,{" "}
                {detail.worker.photoCounts.pending} pending,{" "}
                {detail.worker.photoCounts.rejected} rejected
              </p>
              <p>Profile completeness: {detail.worker.completenessPercent}%</p>
            </CardContent>
          </Card>
        )}

        {detail.recruiter && (
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Recruiter profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-charcoal-300">
              <p>Organization: {detail.recruiter.organizationName || "—"}</p>
              <p>Type: {detail.recruiter.organizationType || "—"}</p>
              <p>Location: {detail.recruiter.location || detail.recruiter.area || "—"}</p>
              <p>
                Openings: {detail.recruiter.publishedOpeningCount} published /{" "}
                {detail.recruiter.openingCount} total
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <UserEntitlementPanel
        userId={detail.user.id}
        entitlement={{
          hasPremiumAccess: detail.entitlement.hasPremiumAccess,
          sources: detail.entitlement.sources,
          billingAccessMode: detail.entitlement.billingAccessMode,
          paidAccess: detail.entitlement.paidAccess,
          adminGrantAccess: detail.entitlement.adminGrantAccess,
          paidSubscription: detail.entitlement.paidSubscription
            ? {
                status: detail.entitlement.paidSubscription.status,
                plan: detail.entitlement.paidSubscription.plan,
                currentPeriodEnd:
                  detail.entitlement.paidSubscription.currentPeriodEnd?.toISOString() ??
                  null,
                stripeBacked: detail.entitlement.paidSubscription.stripeBacked,
              }
            : null,
          adminGrant: detail.entitlement.adminGrant
            ? {
                isLifetime: detail.entitlement.adminGrant.isLifetime,
                expiresAt:
                  detail.entitlement.adminGrant.expiresAt?.toISOString() ?? null,
                reason: detail.entitlement.adminGrant.reason,
              }
            : null,
        }}
      />

      <UserModerationPanel
        userId={detail.user.id}
        accountStatus={detail.user.accountStatus}
        isSelf={isSelf}
      />

      <Card padding="lg">
        <CardHeader>
          <CardTitle>Account activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-charcoal-500">No audit events for this user.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activity.map((event) => (
                <li key={event.id} className="border-b border-charcoal-800 pb-2">
                  <p className="text-charcoal-100">
                    {event.action.replaceAll("_", " ")}
                  </p>
                  <p className="text-charcoal-500">
                    {event.actorAdminEmail} ·{" "}
                    {event.createdAt.toLocaleString()}
                    {event.reason ? ` · ${event.reason}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
