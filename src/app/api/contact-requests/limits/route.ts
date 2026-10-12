import { NextResponse } from "next/server";
import {
  deniedVerifiedRecruiterResponse,
  requireVerifiedRecruiter,
  toRecruiterAccessDto,
} from "@/lib/recruiter-access";
import { getLimitsForRecruiter } from "@/lib/contact-requests";
import { getMessagingSettings } from "@/lib/messaging/settings";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireVerifiedRecruiter();
    if (!actor.ok) {
      return deniedVerifiedRecruiterResponse(actor);
    }

    const [limits, settings] = await Promise.all([
      getLimitsForRecruiter(actor.user.userId),
      getMessagingSettings(),
    ]);

    return NextResponse.json({
      access: toRecruiterAccessDto(actor.access),
      limits,
      followUpAfterHours: settings.followUpAfterHours,
      requestExpiryDays: settings.requestExpiryDays,
    });
  } catch (error) {
    console.error("[ContactRequests] limits failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact request limits" },
      { status: 500 }
    );
  }
}
