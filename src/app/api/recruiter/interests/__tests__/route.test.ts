import { beforeEach, describe, expect, it, vi } from "vitest";

const requestHireConfirmation = vi.fn();
const requestStartConfirmation = vi.fn();

vi.mock("@/app/recruiter/actions", () => ({
  requestHireConfirmation: (...args: unknown[]) =>
    requestHireConfirmation(...args),
  requestStartConfirmation: (...args: unknown[]) =>
    requestStartConfirmation(...args),
}));

const CONTACT_REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const ALIAS_ID = "22222222-2222-4222-8222-222222222222";

function post(path: string, body: Record<string, string>): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("recruiter hire confirmation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestHireConfirmation.mockResolvedValue({
      success: true,
      requestId: "req-1",
    });
    requestStartConfirmation.mockResolvedValue({
      success: true,
      requestId: "req-2",
    });
  });

  it("accepts contactRequestId and the deprecated interestId alias", async () => {
    const { POST: postHire } = await import("../request-hire/route");
    const { POST: postStart } = await import("../request-start/route");

    const hireByContact = await postHire(
      post("/api/recruiter/interests/request-hire", {
        contactRequestId: CONTACT_REQUEST_ID,
      }) as never
    );
    expect(hireByContact.status).toBe(200);
    expect(requestHireConfirmation).toHaveBeenCalledWith(CONTACT_REQUEST_ID);

    const hireByAlias = await postHire(
      post("/api/recruiter/interests/request-hire", {
        interestId: ALIAS_ID,
      }) as never
    );
    expect(hireByAlias.status).toBe(200);
    expect(requestHireConfirmation).toHaveBeenLastCalledWith(ALIAS_ID);

    const startByContact = await postStart(
      post("/api/recruiter/interests/request-start", {
        contactRequestId: CONTACT_REQUEST_ID,
      }) as never
    );
    expect(startByContact.status).toBe(200);
    expect(requestStartConfirmation).toHaveBeenCalledWith(CONTACT_REQUEST_ID);

    const startByAlias = await postStart(
      post("/api/recruiter/interests/request-start", {
        interestId: ALIAS_ID,
      }) as never
    );
    expect(startByAlias.status).toBe(200);
    expect(requestStartConfirmation).toHaveBeenLastCalledWith(ALIAS_ID);

    const missing = await postHire(
      post("/api/recruiter/interests/request-hire", {}) as never
    );
    expect(missing.status).toBe(400);
    expect(requestHireConfirmation).toHaveBeenCalledTimes(2);
  });
});
