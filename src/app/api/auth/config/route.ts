import { NextResponse } from "next/server";
import { isDevBypassAllowed, isEmailProviderConfigured } from "@/lib/auth/config";

/**
 * Returns the current auth configuration for the client.
 * This allows the sign-in page to know which auth methods are available.
 *
 * SECURITY: This only exposes boolean flags, not actual secrets or config values.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    emailEnabled: isEmailProviderConfigured(),
    devBypassEnabled: isDevBypassAllowed(),
  });
}
