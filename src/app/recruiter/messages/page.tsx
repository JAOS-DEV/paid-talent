"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { MessagesInbox } from "@/components/messaging/MessagesInbox";

export default function RecruiterMessagesPage(): React.ReactElement {
  const { data: session, status } = useSession();

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

  return <MessagesInbox basePath="/recruiter/messages" />;
}
