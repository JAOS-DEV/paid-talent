export type VerificationDocType =
  | "passport"
  | "thai_id"
  | "drivers_license"
  | "other";

export interface VerificationDecisionInput {
  action: "approve" | "reject";
  docType: VerificationDocType;
  last4?: string;
  issuingCountry?: string;
  notes?: string;
  canApprove: boolean;
}

/**
 * Build the JSON body for POST /api/admin/workers/[id]/verify.
 * Returns null when approve is requested but canApprove is false.
 */
export function buildVerificationDecisionBody(
  input: VerificationDecisionInput
): Record<string, string> | null {
  if (input.action === "approve" && !input.canApprove) {
    return null;
  }

  const body: Record<string, string> = {
    action: input.action,
    docType: input.docType,
  };

  const last4 = input.last4?.trim();
  const issuingCountry = input.issuingCountry?.trim();
  const notes = input.notes?.trim();

  if (last4) body.last4 = last4;
  if (issuingCountry) body.issuingCountry = issuingCountry;
  if (notes) body.notes = notes;

  return body;
}

export function canSubmitVerificationApprove(canApprove: boolean): boolean {
  return canApprove === true;
}

export function buildPhotoRejectBody(reason?: string): { reason?: string } {
  const trimmed = reason?.trim();
  return trimmed ? { reason: trimmed } : {};
}
