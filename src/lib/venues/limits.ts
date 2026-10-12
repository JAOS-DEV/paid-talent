import { getMessagingSettings } from "@/lib/messaging/settings";

/** Venue count limits sourced from messaging_settings (DB). */
export async function getFreeMaxVenues(): Promise<number> {
  const settings = await getMessagingSettings();
  return settings.freeMaxVenues;
}

export async function getPaidMaxVenues(): Promise<number> {
  const settings = await getMessagingSettings();
  return settings.paidMaxVenues;
}
