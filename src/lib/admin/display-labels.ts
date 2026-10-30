import { isAdminEmail } from "@/lib/admin/allowlist";

/** Server-only: allowlist lookup must not run in the browser. */
export function adminRoleLabel(
  email: string | null | undefined,
  role: "worker" | "recruiter"
): string {
  const normalized = email?.trim().toLowerCase() ?? "";
  if (normalized.startsWith("admin@") || isAdminEmail(email).isAdmin) {
    return "Admin";
  }
  return role === "worker" ? "Talent" : "Venue";
}
