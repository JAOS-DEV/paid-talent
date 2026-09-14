import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { updateBillingAccessMode } from "@/lib/platform-settings";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";
import { revalidatePath } from "next/cache";

const bodySchema = z.object({
  mode: z.enum(["enforced", "open_access"]),
  previousMode: z.enum(["enforced", "open_access"]),
  reason: z.string().min(3).max(1000),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "A reason and confirmed current mode are required." },
        { status: 400 }
      );
    }

    const result = await updateBillingAccessMode({
      nextMode: parsed.data.mode,
      previousMode: parsed.data.previousMode,
      reason: parsed.data.reason,
      adminEmail: guard.actor.email,
      adminUserId: guard.actor.userId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/settings");
    revalidatePath("/recruiter/search");
    revalidatePath("/recruiter/dashboard");

    return NextResponse.json({
      success: true,
      mode: result.mode,
    });
  } catch (error) {
    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }
    console.error("[Admin billing settings]", error);
    return NextResponse.json(
      { error: "Failed to update paywall mode" },
      { status: 500 }
    );
  }
}
