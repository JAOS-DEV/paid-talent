export type AccountStatus = "active" | "suspended" | "banned";
export type AccountRestrictionReason = "banned" | "suspended";

export const ACCOUNT_RESTRICTED_PATH = "/auth/account-restricted";

export function isActiveAccountStatus(
  status: AccountStatus | null | undefined
): boolean {
  return status === "active" || status == null;
}

export function resolveAccountRestriction(input: {
  hasActiveBan: boolean;
  accountStatus?: AccountStatus | null;
}): AccountRestrictionReason | null {
  if (input.hasActiveBan || input.accountStatus === "banned") {
    return "banned";
  }
  if (input.accountStatus === "suspended") {
    return "suspended";
  }
  return null;
}

export function buildAccountRestrictedPath(
  reason: AccountRestrictionReason
): string {
  return `${ACCOUNT_RESTRICTED_PATH}?reason=${reason}`;
}

export function isAccountRestrictedPath(pathname: string): boolean {
  return (
    pathname === ACCOUNT_RESTRICTED_PATH ||
    pathname.startsWith(`${ACCOUNT_RESTRICTED_PATH}/`)
  );
}
