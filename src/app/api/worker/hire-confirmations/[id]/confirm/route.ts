import { NextResponse } from "next/server";
import { confirmHireConfirmationRequest } from "@/app/worker/hire-confirmation-actions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const result = await confirmHireConfirmationRequest(id);

    if (!result.success) {
      const status =
        result.error === "Unauthorized"
          ? 401
          : result.error === "Account restricted"
            ? 403
            : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
