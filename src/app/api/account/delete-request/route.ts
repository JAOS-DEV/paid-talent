import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import { requestAccountDeletion } from "@/lib/account/deletion";
import { accountDeletionPhraseError } from "@/lib/account/deletion";
import { localeFromCookieHeader } from "@/lib/i18n/locale";

const bodySchema = z.object({
  confirmPhrase: z.string(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({
      role: ["worker", "recruiter"],
    });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }
    if (!actor.user.email) {
      return NextResponse.json(
        { error: "Account email is required." },
        { status: 400 }
      );
    }

    const locale = localeFromCookieHeader(request.headers.get("cookie"));
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: accountDeletionPhraseError(locale) },
        { status: 400 }
      );
    }

    const result = await requestAccountDeletion({
      userId: actor.user.userId,
      email: actor.user.email,
      confirmPhrase: parsed.data.confirmPhrase,
      locale,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Account] delete-request failed:", error);
    return NextResponse.json(
      { error: "Could not request account deletion." },
      { status: 500 }
    );
  }
}
