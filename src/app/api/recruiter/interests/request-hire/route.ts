import { NextRequest, NextResponse } from "next/server";
import { requestHireConfirmation } from "@/app/recruiter/actions";
import { z } from "zod";

const requestSchema = z.object({
  interestId: z.string().uuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const result = await requestHireConfirmation(validation.data.interestId);

    if (!result.success) {
      const status = result.error === "Unauthorized" ? 401 : 400;
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
