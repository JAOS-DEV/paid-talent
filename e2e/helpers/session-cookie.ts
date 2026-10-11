/**
 * Auth.js / NextAuth session cookie names only.
 * Ignores CSRF (authjs.csrf-token, __Host-authjs.csrf-token) and callback-url cookies.
 */
const SESSION_COOKIE_NAME =
  /^(__Secure-)?(authjs|next-auth)\.session-token(\.\d+)?$/;

export function isAuthSessionCookieName(name: string): boolean {
  return SESSION_COOKIE_NAME.test(name);
}

export function findAuthSessionCookie<T extends { name: string; value: string }>(
  cookies: T[]
): T | undefined {
  return cookies.find(
    (cookie) => isAuthSessionCookieName(cookie.name) && Boolean(cookie.value)
  );
}
