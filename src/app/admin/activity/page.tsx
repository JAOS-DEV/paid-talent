import React from "react";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import {
  ADMIN_ACTIVITY_PAGE_SIZE,
  countAdminAuditEvents,
  listRecentAdminAuditEvents,
} from "@/lib/admin/activity";
import { Card, CardContent } from "@/components/ui";

interface AdminActivityPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminActivityPage({
  searchParams,
}: AdminActivityPageProps): Promise<React.ReactElement> {
  await requireAdminPage("/admin/activity");
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * ADMIN_ACTIVITY_PAGE_SIZE;
  const [events, total] = await Promise.all([
    listRecentAdminAuditEvents(ADMIN_ACTIVITY_PAGE_SIZE, offset),
    countAdminAuditEvents(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_ACTIVITY_PAGE_SIZE));

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
      <div className="flex items-center justify-between text-sm text-charcoal-400">
        <p>
          Page {page} of {totalPages} · {total} events
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              prefetch={false}
              className="px-3 py-2 rounded-lg bg-charcoal-800"
              href={`/admin/activity?page=${page - 1}`}
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              prefetch={false}
              className="px-3 py-2 rounded-lg bg-charcoal-800"
              href={`/admin/activity?page=${page + 1}`}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
