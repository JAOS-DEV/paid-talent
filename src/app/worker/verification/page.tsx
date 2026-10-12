"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { IdentityVerificationFlow } from "@/components/verification/IdentityVerificationFlow";

export default function WorkerVerificationPage(): React.ReactElement {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session || session.user.role !== "worker") {
    router.replace("/auth/signin");
    return <div />;
  }

  return (
    <IdentityVerificationFlow
      apiBasePath="/api/worker/verification"
      translationNamespace="worker.verificationFlow"
      onVerifiedHref="/worker/dashboard"
    />
  );
}
