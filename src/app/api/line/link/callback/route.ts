import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import { db } from "@/lib/db";
import { lineLinks } from "@/lib/db/schema";
import {
  getLineLinkCallbackUrl,
  getLineLoginChannelId,
  getLineLoginChannelSecret,
  isLineLoginConfigured,
} from "@/lib/line/config";
import {
  LINE_LINK_STATE_COOKIE,
  statesMatch,
  verifyLineLinkStateCookie,
} from "@/lib/line/state-cookie";

function settingsRedirect(query: string): NextResponse {
  const base = (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const response = NextResponse.redirect(
    `${base}/settings/notifications?${query}`
  );
  response.cookies.set(LINE_LINK_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({
      role: ["worker", "recruiter"],
    });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    if (!isLineLoginConfigured()) {
      return settingsRedirect("line=error");
    }

    const clientId = getLineLoginChannelId();
    const clientSecret = getLineLoginChannelSecret();
    if (!clientId || !clientSecret) {
      return settingsRedirect("line=error");
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const cookieRaw = request.cookies.get(LINE_LINK_STATE_COOKIE)?.value;
    const cookiePayload = verifyLineLinkStateCookie(cookieRaw);

    if (
      !code ||
      !cookiePayload ||
      !statesMatch(state, cookiePayload.state)
    ) {
      return settingsRedirect("line=error");
    }

    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: getLineLinkCallbackUrl(),
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[LINE link callback] token exchange failed", tokenRes.status);
      return settingsRedirect("line=error");
    }

    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      id_token?: string;
    };

    if (!tokenJson.access_token || !tokenJson.id_token) {
      return settingsRedirect("line=error");
    }

    const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: tokenJson.id_token,
        client_id: clientId,
        nonce: cookiePayload.nonce,
      }),
    });

    if (!verifyRes.ok) {
      console.error("[LINE link callback] id_token verify failed", verifyRes.status);
      return settingsRedirect("line=error");
    }

    const verifyJson = (await verifyRes.json()) as {
      sub?: string;
      name?: string;
    };

    const lineUserId = verifyJson.sub?.trim();
    if (!lineUserId) {
      return settingsRedirect("line=error");
    }

    const [existingOther] = await db
      .select({ userId: lineLinks.userId })
      .from(lineLinks)
      .where(
        and(
          eq(lineLinks.lineUserId, lineUserId),
          ne(lineLinks.userId, actor.user.userId)
        )
      )
      .limit(1);

    if (existingOther) {
      return settingsRedirect("line=already_linked");
    }

    let isFriend = false;
    try {
      const friendshipRes = await fetch(
        "https://api.line.me/friendship/v1/status",
        {
          headers: {
            Authorization: `Bearer ${tokenJson.access_token}`,
          },
        }
      );
      if (friendshipRes.ok) {
        const friendship = (await friendshipRes.json()) as {
          friendFlag?: boolean;
        };
        isFriend = friendship.friendFlag === true;
      }
    } catch (error) {
      console.warn("[LINE link callback] friendship check failed", error);
    }

    const now = new Date();
    const displayName =
      typeof verifyJson.name === "string" ? verifyJson.name : null;

    await db
      .insert(lineLinks)
      .values({
        userId: actor.user.userId,
        lineUserId,
        displayName,
        isFriend,
        friendStatusUpdatedAt: now,
        linkedAt: now,
      })
      .onConflictDoUpdate({
        target: lineLinks.userId,
        set: {
          lineUserId,
          displayName,
          isFriend,
          friendStatusUpdatedAt: now,
          linkedAt: now,
        },
      });

    return settingsRedirect("line=linked");
  } catch (error) {
    console.error("[LINE link callback] failed:", error);
    return settingsRedirect("line=error");
  }
}
