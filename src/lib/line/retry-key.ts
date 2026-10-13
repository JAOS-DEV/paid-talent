import { randomUUID } from "crypto";
import { validate as uuidValidate, v5 as uuidv5 } from "uuid";

/** Stable namespace for deriving LINE retry keys from non-UUID ids. */
const LINE_RETRY_NAMESPACE = "a3f1c8e2-4b5d-4e6f-8a9b-0c1d2e3f4a5b";

/**
 * X-Line-Retry-Key must be stable per notification so LINE dedupes retries.
 * Prefer the notification UUID itself; otherwise derive uuid v5.
 */
export function lineRetryKeyForNotification(
  notificationId: string | undefined
): string {
  if (!notificationId) {
    return randomUUID();
  }
  if (uuidValidate(notificationId)) {
    return notificationId;
  }
  return uuidv5(notificationId, LINE_RETRY_NAMESPACE);
}
