import React from "react";
import { requireAdminPage } from "@/lib/admin/guard";
import { ConversationViewGate } from "@/components/admin/ConversationViewGate";

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
        <h1 className="text-2xl font-bold text-charcoal-100">
          Conversation review
        </h1>
        <p className="text-charcoal-400 mt-1 font-mono text-sm">{id}</p>
      </div>
      <ConversationViewGate conversationId={id} />
    </div>
  );
}
