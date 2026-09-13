/**
 * Validates attaching an opening to a recruiter interest.
 *
 * Product rule: linked openings must be published. General interests
 * (openingId null) remain allowed.
 */

export interface OpeningAttachmentCandidate {
  id: string;
  recruiterProfileId: string;
  isPublished: boolean;
}

export type OpeningAttachmentResult =
  | { ok: true; openingId: string | null }
  | { ok: false; error: string; status: 400 | 403 | 404 };

export function resolveOpeningAttachment(params: {
  openingId: string | null | undefined;
  recruiterProfileId: string;
  opening: OpeningAttachmentCandidate | null;
}): OpeningAttachmentResult {
  const { openingId, recruiterProfileId, opening } = params;

  if (openingId == null || openingId === "") {
    return { ok: true, openingId: null };
  }

  if (!opening || opening.id !== openingId) {
    return { ok: false, error: "Opening not found", status: 404 };
  }

  if (opening.recruiterProfileId !== recruiterProfileId) {
    return {
      ok: false,
      error: "Cannot attach another recruiter's opening",
      status: 403,
    };
  }

  if (!opening.isPublished) {
    return {
      ok: false,
      error: "Opening must be published before attaching to an interest",
      status: 400,
    };
  }

  return { ok: true, openingId: opening.id };
}

/**
 * Worker-facing opening tags only expose published openings.
 * Draft/unpublished openings must never leak into worker context.
 */
export function isOpeningVisibleToWorkers(isPublished: boolean): boolean {
  return isPublished === true;
}

export function canWorkerAccessInterestContext(params: {
  requestingWorkerUserId: string | null | undefined;
  interestOwnerUserId: string | null | undefined;
}): boolean {
  const { requestingWorkerUserId, interestOwnerUserId } = params;
  if (!requestingWorkerUserId || !interestOwnerUserId) {
    return false;
  }
  return requestingWorkerUserId === interestOwnerUserId;
}
