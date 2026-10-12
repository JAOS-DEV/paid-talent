import { NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";
import {
  getRecruiterAccess,
  toRecruiterAccessDto,
} from "@/lib/recruiter-access";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const access = await getRecruiterAccess(actor.user.userId);
    return NextResponse.json(toRecruiterAccessDto(access));
  } catch (error) {
    console.error("[Recruiter Access] Error:", error);

    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }

    return NextResponse.json(
      { error: "Failed to load recruiter access" },
      { status: 500 }
    );
  }
}
