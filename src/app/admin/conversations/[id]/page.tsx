import React from "react";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { ConversationViewGate } from "@/components/admin/ConversationViewGate";
import { ShortId } from "@/components/admin/admin-display";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminConversationPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  await requireAdminPage("/admin/conversations");
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/reports"
          prefetch={false}
          className="inline-flex min-h-11 items-center text-sm text-primary-300 hover:text-primary-200"
        >
          Back to reports
        </Link>
        <h1 className="text-2xl font-bold text-charcoal-100">
          Conversation review
        </h1>
        <div className="mt-1">
          <ShortId id={id} />
        </div>
      </div>
      <ConversationViewGate conversationId={id} />
    </div>
  );
}
