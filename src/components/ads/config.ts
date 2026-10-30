export const ADSENSE_ENABLED = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";
export const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

/** True only when a real AdSense client is configured. */
export const ADS_CONFIGURED =
  ADSENSE_ENABLED && Boolean(ADSENSE_CLIENT_ID);
