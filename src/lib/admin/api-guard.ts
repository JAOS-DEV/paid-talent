import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/allowlist";

export interface AdminApiActor {
  userId: string;
  email: string;
}

export type AdminApiGuardResult =
  | { ok: true; actor: AdminApiActor }
  | { ok: false; response: NextResponse };

export async function requireAdminApi(): Promise<AdminApiGuardResult> {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const adminCheck = isAdminEmail(session.user.email);
  if (!adminCheck.isAdmin || !adminCheck.email) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", reason: adminCheck.reason },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    actor: {
      userId: session.user.id,
      email: adminCheck.email,
    },
  };
}
