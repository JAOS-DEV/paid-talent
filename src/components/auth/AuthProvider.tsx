"use client";

import React, { type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
  return <SessionProvider>{children}</SessionProvider>;
}
