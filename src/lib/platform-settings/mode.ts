import type { BillingAccessMode } from "@/lib/db/schema";

export const DEFAULT_BILLING_ACCESS_MODE: BillingAccessMode = "enforced";

export function isBillingAccessMode(
  value: string | null | undefined
): value is BillingAccessMode {
  return value === "enforced" || value === "open_access";
}

export function describeBillingAccessMode(mode: BillingAccessMode): {
  label: string;
  description: string;
} {
  if (mode === "open_access") {
    return {
      label: "Open Access",
      description:
        "Premium features are temporarily available without subscription. Top Talent status/badges still remain visible and continue tracking normally.",
    };
  }

  return {
    label: "Enabled",
    description:
      "Paid/admin entitlement required for premium features.",
  };
}
