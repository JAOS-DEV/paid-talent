import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "@/app/api/interests/route";

describe("POST /api/interests", () => {
  it("returns 410 Gone with replacement path", async () => {
    const response = await POST({} as NextRequest);
    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error).toBe("Replaced by contact requests");
    expect(body.replacement).toBe("/api/contact-requests");
  });
});
