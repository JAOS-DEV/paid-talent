import { NextResponse } from "next/server";
import { getWorkerDashboardData } from "@/lib/worker-dashboard";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const dashboard = await getWorkerDashboardData(actor.user.userId);
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error("[Worker Dashboard] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard" },
      { status: 500 }
    );
  }
}
