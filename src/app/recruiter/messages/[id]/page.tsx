"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { redirect, useParams } from "next/navigation";
import { ChatView } from "@/components/messaging/ChatView";

export default function RecruiterChatPage(): React.ReactElement {
  const { data: session, status } = useSession();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!session || session.user.role !== "recruiter") {
    redirect("/auth/signin");
  }

  return (
    <ChatView
      conversationId={id}
      role="recruiter"
      listHref="/recruiter/messages"
      profileSettingsHref="/recruiter/profile"
      contentClassName="max-w-7xl"
    />
  );
}
