import React from "react";
import { requireAdminPage } from "@/lib/admin/guard";
import { listRecentAdminAuditEvents } from "@/lib/admin/activity";
import { Card, CardContent } from "@/components/ui";

export default async function AdminActivityPage(): Promise<React.ReactElement> {
  await requireAdminPage("/admin/activity");
  const events = await listRecentAdminAuditEvents(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Activity</h1>
        <p className="text-charcoal-400 mt-1">
          Recent admin moderation, entitlement, and paywall actions.
        </p>
      </div>
      <Card padding="none">
        <CardContent>
          {events.length === 0 ? (
            <p className="p-4 text-sm text-charcoal-500">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-charcoal-800">
              {events.map((event) => (
                <li key={event.id} className="px-4 py-3 text-sm">
                  <p className="text-charcoal-100">
                    {event.action.replaceAll("_", " ")}
                  </p>
                  <p className="text-charcoal-500 mt-1">
                    {event.actorAdminEmail}
                    {event.targetIdentity ? ` → ${event.targetIdentity}` : ""}
                    {" · "}
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
