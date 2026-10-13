import { NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import {
  getLineLinkCallbackUrl,
  getLineLoginChannelId,
  isLineLoginConfigured,
} from "@/lib/line/config";
import {
  LINE_LINK_STATE_COOKIE,
  LINE_LINK_STATE_MAX_AGE_SEC,
  createLineLinkOAuthPayload,
  signLineLinkStateCookie,
} from "@/lib/line/state-cookie";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({
      role: ["worker", "recruiter"],
    });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    if (!isLineLoginConfigured()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const clientId = getLineLoginChannelId();
    if (!clientId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload = createLineLinkOAuthPayload();
    const cookieValue = signLineLinkStateCookie(payload);
    const redirectUri = encodeURIComponent(getLineLinkCallbackUrl());
    const authorizeUrl =
      `https://access.line.me/oauth2/v2.1/authorize` +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${redirectUri}` +
      `&state=${encodeURIComponent(payload.state)}` +
      `&scope=${encodeURIComponent("profile openid")}` +
      `&nonce=${encodeURIComponent(payload.nonce)}` +
      `&bot_prompt=aggressive`;

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(LINE_LINK_STATE_COOKIE, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: LINE_LINK_STATE_MAX_AGE_SEC,
    });
    return response;
  } catch (error) {
    console.error("[LINE link start] failed:", error);
    return NextResponse.json(
      { error: "Failed to start LINE linking" },
      { status: 500 }
    );
  }
}
