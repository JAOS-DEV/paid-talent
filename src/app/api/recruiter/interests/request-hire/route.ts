import { NextRequest, NextResponse } from "next/server";
import { requestHireConfirmation } from "@/app/recruiter/actions";
import { z } from "zod";

const requestSchema = z
  .object({
    contactRequestId: z.string().uuid().optional(),
    interestId: z.string().uuid().optional(),
  })
  .refine(
    (value) =>
      value.contactRequestId !== undefined || value.interestId !== undefined,
    { message: "contactRequestId is required" }
  );

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

    const contactRequestId =
      validation.data.contactRequestId ?? validation.data.interestId;
    if (!contactRequestId) {
      return NextResponse.json(
        { success: false, error: "contactRequestId is required" },
        { status: 400 }
      );
    }

    const result = await requestHireConfirmation(contactRequestId);

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
