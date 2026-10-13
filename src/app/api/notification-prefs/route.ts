import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import { getLineLinkStatusForUser } from "@/lib/line/link-status";
import { isEmailTransportConfigured } from "@/lib/notifications/email";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from "@/lib/notifications/prefs";

const putSchema = z.object({
  emailEnabled: z.boolean().optional(),
  lineEnabled: z.boolean().optional(),
  locale: z.enum(["en", "th"]).optional(),
});

async function prefsResponse(prefs: {
  userId: string;
  emailEnabled: boolean;
  lineEnabled: boolean;
  locale: string;
}) {
  const line = await getLineLinkStatusForUser(prefs.userId);
  return {
    emailEnabled: prefs.emailEnabled,
    lineEnabled: prefs.lineEnabled,
    locale: prefs.locale === "en" || prefs.locale === "th" ? prefs.locale : "th",
    emailConfigured: isEmailTransportConfigured(),
    ...line,
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({
      role: ["worker", "recruiter"],
    });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const prefs = await getNotificationPrefs(actor.user.userId);
    return NextResponse.json(
      await prefsResponse({
        userId: prefs.userId,
        emailEnabled: prefs.emailEnabled,
        lineEnabled: prefs.lineEnabled,
        locale: prefs.locale,
      })
    );
  } catch (error) {
    console.error("[NotificationPrefs] get failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({
      role: ["worker", "recruiter"],
    });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const body = await request.json();
    const validation = putSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const prefs = await updateNotificationPrefs({
      userId: actor.user.userId,
      emailEnabled: validation.data.emailEnabled,
      lineEnabled: validation.data.lineEnabled,
      locale: validation.data.locale,
    });

    return NextResponse.json(
      await prefsResponse({
        userId: prefs.userId,
        emailEnabled: prefs.emailEnabled,
        lineEnabled: prefs.lineEnabled,
        locale: prefs.locale,
      })
    );
  } catch (error) {
    console.error("[NotificationPrefs] put failed:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}
