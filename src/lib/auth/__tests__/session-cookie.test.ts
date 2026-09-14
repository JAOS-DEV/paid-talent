import { describe, expect, it } from "vitest";
import {
  getAuthSessionCookieName,
  resolveAuthSessionCookieTarget,
} from "../session-cookie";

describe("auth session cookie targeting", () => {
  it("reuses the existing pending Auth.js cookie name so salt stays valid", () => {
    const store = {
      values: { "authjs.session-token": "pending-jwe" } as Record<string, string>,
      get(name: string): { value: string } | undefined {
        const value = this.values[name];
        return value ? { value } : undefined;
      },
      set(): void {
        return;
      },
    };

    expect(
      resolveAuthSessionCookieTarget({
        cookieStore: store,
        authUrl: "https://paidtalent.com",
        nodeEnv: "production",
      })
    ).toEqual({ name: "authjs.session-token", secure: false });
  });

  it("uses the __Secure- name when that cookie is already present", () => {
    const store = {
      values: { "__Secure-authjs.session-token": "pending-jwe" } as Record<
        string,
        string
      >,
      get(name: string): { value: string } | undefined {
        const value = this.values[name];
        return value ? { value } : undefined;
      },
      set(): void {
        return;
      },
    };

    expect(
      resolveAuthSessionCookieTarget({
        cookieStore: store,
        nodeEnv: "development",
      })
    ).toEqual({
      name: getAuthSessionCookieName(true),
      secure: true,
    });
  });
});
