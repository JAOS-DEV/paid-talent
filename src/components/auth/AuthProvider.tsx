"use client";

import React, { type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

interface AuthProviderProps {
  children: ReactNode;
  session: Session | null;
}

export function AuthProvider({
  children,
  session,
}: AuthProviderProps): React.ReactElement {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
