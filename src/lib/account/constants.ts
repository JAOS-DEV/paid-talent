import enMessages from "../../../messages/en.json";
import thMessages from "../../../messages/th.json";
import type { Locale } from "@/lib/i18n/config";

/** Confirmation phrases, one per locale. The active locale's phrase is the only one accepted. */
export const ACCOUNT_DELETION_CONFIRM_PHRASES: Record<Locale, string> = {
  en: enMessages.accountDeletion.confirmPhrase,
  th: thMessages.accountDeletion.confirmPhrase,
};

/** English phrase. Prefer {@link ACCOUNT_DELETION_CONFIRM_PHRASES} with the request locale. */
export const ACCOUNT_DELETION_CONFIRM_PHRASE = ACCOUNT_DELETION_CONFIRM_PHRASES.en;

export const ACCOUNT_PURGE_DAYS = 30;

export const SELF_DELETION_REASON = "self_deletion_requested";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
