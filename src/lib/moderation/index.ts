export type ModerationResult = {
  approved: boolean;
  flagged: boolean;
  reason?: string;
  confidence?: number;
  categories?: ModerationCategory[];
};

export type ModerationCategory =
  | "adult"
  | "violence"
  | "hate"
  | "spam"
  | "illegal"
  | "other";

export * from "./photo-policy";
export * from "./photo-provider";
export * from "./photo-moderation";

export interface ModerationProvider {
  name: string;
  moderateImage(imageUrl: string): Promise<ModerationResult>;
  moderateText(text: string): Promise<ModerationResult>;
}

class DefaultModerationProvider implements ModerationProvider {
  name = "default-stub";

  async moderateImage(_imageUrl: string): Promise<ModerationResult> {
    console.log("[Moderation Stub] Image moderation called - auto-approving");
    return {
      approved: true,
      flagged: false,
    };
  }

  async moderateText(_text: string): Promise<ModerationResult> {
    console.log("[Moderation Stub] Text moderation called - auto-approving");
    return {
      approved: true,
      flagged: false,
    };
  }
}

let currentProvider: ModerationProvider = new DefaultModerationProvider();

export function setModerationProvider(provider: ModerationProvider): void {
  currentProvider = provider;
}

export function getModerationProvider(): ModerationProvider {
  return currentProvider;
}

export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  return currentProvider.moderateImage(imageUrl);
}

export async function moderateText(text: string): Promise<ModerationResult> {
  return currentProvider.moderateText(text);
}

export async function moderateProfilePhoto(
  imageUrl: string,
  userId: string
): Promise<ModerationResult> {
  console.log(`[Moderation] Checking profile photo for user ${userId}`);
  const result = await moderateImage(imageUrl);

  if (result.flagged) {
    console.warn(
      `[Moderation] Profile photo flagged for user ${userId}: ${result.reason}`
    );
  }

  return result;
}

export async function moderateProfileContent(
  content: {
    bio?: string;
    description?: string;
    displayName?: string;
  },
  userId: string
): Promise<ModerationResult> {
  console.log(`[Moderation] Checking profile content for user ${userId}`);

  const textsToCheck = [content.bio, content.description, content.displayName]
    .filter(Boolean)
    .join(" ");

  if (!textsToCheck) {
    return { approved: true, flagged: false };
  }

  const result = await moderateText(textsToCheck);

  if (result.flagged) {
    console.warn(
      `[Moderation] Profile content flagged for user ${userId}: ${result.reason}`
    );
  }

  return result;
}

export interface ModerationWebhookPayload {
  type: "image" | "text";
  resourceId: string;
  resourceType: "profile_photo" | "profile_content";
  userId: string;
  result: ModerationResult;
  timestamp: Date;
}

export async function sendModerationWebhook(
  payload: ModerationWebhookPayload
): Promise<void> {
  const webhookUrl = process.env.MODERATION_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log("[Moderation Webhook] No webhook URL configured - skipping");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MODERATION_WEBHOOK_SECRET || ""}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        `[Moderation Webhook] Failed to send webhook: ${response.status}`
      );
    }
  } catch (error) {
    console.error("[Moderation Webhook] Error sending webhook:", error);
  }
}
