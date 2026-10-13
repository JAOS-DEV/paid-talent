import { NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import { listNotificationsForUser } from "@/lib/notifications";
import { renderNotification } from "@/lib/notifications/render";
import { getNotificationPrefs } from "@/lib/notifications/prefs";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({
      role: ["worker", "recruiter"],
    });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const prefs = await getNotificationPrefs(actor.user.userId);
    const { notifications, unreadCount } = await listNotificationsForUser(
      actor.user.userId,
      50
    );

    return NextResponse.json({
      unreadCount,
      notifications: notifications.map((row) => {
        const rendered = renderNotification(
          row.type,
          row.payload,
          prefs.locale,
          { role: actor.user.role }
        );
        return {
          id: row.id,
          type: row.type,
          payload: row.payload,
          readAt: row.readAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          subject: rendered.subject,
          text: rendered.text,
          url: rendered.url,
        };
      }),
    });
  } catch (error) {
    console.error("[Notifications] list failed:", error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}
