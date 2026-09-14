import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { db, users, type DbClient } from "@/lib/db";
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
      const revoked = await db.transaction(async (tx) => {
        const client = tx as DbClient;
        const result = await revokeAdminEntitlement({
          userId: target.id,
          adminEmail: guard.actor.email,
          reason: parsed.data.reason,
          db: client,
        });
        if (!result) {
          return null;
        }
        await recordAdminAuditEvent({
          action: "admin_premium_revoked",
          actorAdminEmail: guard.actor.email,
          actorUserId: guard.actor.userId,
          targetUserId: target.id,
          targetIdentity: target.email,
          targetType: "admin_entitlement",
          targetId: result.id,
          reason: parsed.data.reason,
          metadata: {
            isLifetime: result.isLifetime,
            expiresAt: result.expiresAt,
          },
          db: client,
        });
        return result;
      });
      if (!revoked) {
        return NextResponse.json(
          { error: "No active admin grant to revoke." },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, revoked: true });
    }

    if (parsed.data.action !== "grant") {
      return NextResponse.json(
        { error: "Invalid entitlement request." },
        { status: 400 }
      );
    }

    if (parsed.data.grantKind === "days" && !parsed.data.days) {
      return NextResponse.json(
        { error: "A number of days is required." },
        { status: 400 }
      );
    }

    const grantKind = parsed.data.grantKind;
    const grantDays = parsed.data.days;
    const grantReason = parsed.data.reason;

    const result = await db.transaction(async (tx) => {
      const client = tx as DbClient;
      const grantResult = await upsertAdminEntitlement({
        userId: target.id,
        requested:
          grantKind === "lifetime"
            ? { kind: "lifetime" }
            : { kind: "days", days: grantDays ?? 0 },
        reason: grantReason,
        adminEmail: guard.actor.email,
        db: client,
      });

      await recordAdminAuditEvent({
        action: grantAuditAction(grantResult.action),
        actorAdminEmail: guard.actor.email,
        actorUserId: guard.actor.userId,
        targetUserId: target.id,
        targetIdentity: target.email,
        targetType: "admin_entitlement",
        targetId: grantResult.grant.id,
        reason: grantReason,
        metadata: {
          before: grantResult.previousGrant
            ? {
                isLifetime: grantResult.previousGrant.isLifetime,
                expiresAt: grantResult.previousGrant.expiresAt,
              }
            : null,
          after: {
            isLifetime: grantResult.grant.isLifetime,
            expiresAt: grantResult.grant.expiresAt,
          },
        },
        db: client,
      });

      return grantResult;
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
