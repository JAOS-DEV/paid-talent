"use server";

import { cookies } from "next/headers";
import { isValidLocale } from "./config";
import { LOCALE_COOKIE } from "./locale";

export async function setUserLocale(locale: string): Promise<void> {
  if (!isValidLocale(locale)) {
    return;
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
}
