import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  countLaunchDiscountSeatsUsed,
  getBillingPriceSettings,
  updateBillingPriceSettings,
} from "@/lib/billing/price-settings";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";
import { revalidatePath } from "next/cache";

const nullableId = z.union([z.string().min(1).max(200), z.null()]);

const putSchema = z.object({
  monthlyPriceId: nullableId.optional(),
  annualPriceId: nullableId.optional(),
  pass7dPriceId: nullableId.optional(),
  launchCouponId: nullableId.optional(),
  launchEnabled: z.boolean().optional(),
  launchSeatsLimit: z.number().int().min(0).max(100_000).optional(),
  firstPassCouponId: nullableId.optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const [settings, launchSeatsUsed] = await Promise.all([
      getBillingPriceSettings(),
      countLaunchDiscountSeatsUsed(),
    ]);

    return NextResponse.json({
      settings: {
        monthlyPriceId: settings.monthlyPriceId,
        annualPriceId: settings.annualPriceId,
        pass7dPriceId: settings.pass7dPriceId,
        launchCouponId: settings.launchCouponId,
        launchEnabled: settings.launchEnabled,
        launchSeatsLimit: settings.launchSeatsLimit,
        firstPassCouponId: settings.firstPassCouponId,
        updatedAt: settings.updatedAt.toISOString(),
        updatedBy: settings.updatedBy,
      },
      launchSeatsUsed,
    });
  } catch (error) {
    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }
    console.error("[Admin billing prices GET]", error);
    return NextResponse.json(
      { error: "Failed to load billing price settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const parsed = putSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid billing price settings payload" },
        { status: 400 }
      );
    }

    const result = await updateBillingPriceSettings({
      patch: parsed.data,
      adminEmail: guard.actor.email,
      adminUserId: guard.actor.userId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, errors: result.errors },
        { status: result.status }
      );
    }

    revalidatePath("/admin/settings");
    revalidatePath("/recruiter/upgrade");

    const launchSeatsUsed = await countLaunchDiscountSeatsUsed();

    return NextResponse.json({
      success: true,
      settings: {
        monthlyPriceId: result.settings.monthlyPriceId,
        annualPriceId: result.settings.annualPriceId,
        pass7dPriceId: result.settings.pass7dPriceId,
        launchCouponId: result.settings.launchCouponId,
        launchEnabled: result.settings.launchEnabled,
        launchSeatsLimit: result.settings.launchSeatsLimit,
        firstPassCouponId: result.settings.firstPassCouponId,
        updatedAt: result.settings.updatedAt.toISOString(),
        updatedBy: result.settings.updatedBy,
      },
      warnings: result.warnings,
      launchSeatsUsed,
    });
  } catch (error) {
    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }
    console.error("[Admin billing prices PUT]", error);
    return NextResponse.json(
      { error: "Failed to update billing price settings" },
      { status: 500 }
    );
  }
}
