import { NextRequest, NextResponse } from "next/server";
import { markAsHired } from "@/app/recruiter/actions";
import { z } from "zod";

const requestSchema = z.object({
  interestId: z.string().uuid(),
  notes: z.string().max(500).optional(),
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

    const { interestId, notes } = validation.data;
    const result = await markAsHired(interestId, notes);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
