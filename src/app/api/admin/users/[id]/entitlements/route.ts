import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  revokeAdminEntitlement,
  upsertAdminEntitlement,
} from "@/lib/entitlements/grants";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";
import type { AdminAuditAction } from "@/lib/db/schema";
import { isAppUserId } from "@/lib/auth/pending-signup";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("grant"),
    grantKind: z.enum(["days", "lifetime"]),
    days: z.number().int().min(1).max(3650).optional(),
    reason: z.string().min(3).max(1000),
  }),
  z.object({
    action: z.literal("revoke"),
    reason: z.string().min(3).max(1000),
  }),
]);

function grantAuditAction(
  action: "grant" | "extend" | "lifetime"
): AdminAuditAction {
  if (action === "lifetime") {
    return "lifetime_premium_granted";
  }
  if (action === "extend") {
    return "admin_premium_extended";
  }
  return "admin_premium_granted";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const { id } = await params;
    if (!isAppUserId(id)) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid entitlement request." },
        { status: 400 }
      );
    }

    const [target] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (parsed.data.action === "revoke") {
      const revoked = await revokeAdminEntitlement({
        userId: target.id,
        adminEmail: guard.actor.email,
        reason: parsed.data.reason,
      });
      if (!revoked) {
        return NextResponse.json(
          { error: "No active admin grant to revoke." },
          { status: 400 }
        );
      }
      await recordAdminAuditEvent({
        action: "admin_premium_revoked",
        actorAdminEmail: guard.actor.email,
        actorUserId: guard.actor.userId,
        targetUserId: target.id,
        targetIdentity: target.email,
        targetType: "admin_entitlement",
        targetId: revoked.id,
        reason: parsed.data.reason,
        metadata: {
          isLifetime: revoked.isLifetime,
          expiresAt: revoked.expiresAt,
        },
      });
      return NextResponse.json({ success: true, revoked: true });
    }

    if (parsed.data.grantKind === "days" && !parsed.data.days) {
      return NextResponse.json(
        { error: "A number of days is required." },
        { status: 400 }
      );
    }

    const result = await upsertAdminEntitlement({
      userId: target.id,
      requested:
        parsed.data.grantKind === "lifetime"
          ? { kind: "lifetime" }
          : { kind: "days", days: parsed.data.days ?? 0 },
      reason: parsed.data.reason,
      adminEmail: guard.actor.email,
    });

    await recordAdminAuditEvent({
      action: grantAuditAction(result.action),
      actorAdminEmail: guard.actor.email,
      actorUserId: guard.actor.userId,
      targetUserId: target.id,
      targetIdentity: target.email,
      targetType: "admin_entitlement",
      targetId: result.grant.id,
      reason: parsed.data.reason,
      metadata: {
        before: result.previousGrant
          ? {
              isLifetime: result.previousGrant.isLifetime,
              expiresAt: result.previousGrant.expiresAt,
            }
          : null,
        after: {
          isLifetime: result.grant.isLifetime,
          expiresAt: result.grant.expiresAt,
        },
      },
    });

    return NextResponse.json({
      success: true,
      action: result.action,
      isLifetime: result.grant.isLifetime,
      expiresAt: result.grant.expiresAt,
    });
  } catch (error) {
    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }
    console.error("[Admin entitlements]", error);
    return NextResponse.json(
      { error: "Failed to update entitlement" },
      { status: 500 }
    );
  }
}
