import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { listAdminFlags } from "@/lib/admin/reports";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") ?? "open";
    const status =
      statusParam === "all" ||
      statusParam === "open" ||
      statusParam === "dismissed" ||
      statusParam === "actioned"
        ? statusParam
        : "open";

    const flags = await listAdminFlags({ status });
    return NextResponse.json({ flags });
  } catch (error) {
    console.error("[Admin flags] list failed:", error);
    return NextResponse.json({ error: "Failed to list flags" }, { status: 500 });
  }
}
