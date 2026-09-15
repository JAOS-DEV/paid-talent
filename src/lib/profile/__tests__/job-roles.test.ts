import { describe, expect, it } from "vitest";
import {
  JOB_ROLE_OPTIONS,
  OTHER_JOB_ROLE,
  PREDEFINED_JOB_ROLES,
  normalizeAndValidateJobRoles,
  splitStoredJobRoles,
  toPersistedJobRoles,
} from "../job-roles";
import { MAX_JOB_ROLES } from "../limits";
import { PROFANITY_BLOCKED_MESSAGE } from "@/lib/helpers/profanity-filter";
import { CONTACT_CIRCUMVENTION_MESSAGE } from "../public-text";

describe("job roles", () => {
  it("includes Dancer, PR / Promotions, and Other", () => {
    expect(PREDEFINED_JOB_ROLES).toContain("Dancer");
    expect(PREDEFINED_JOB_ROLES).toContain("PR / Promotions");
    expect(JOB_ROLE_OPTIONS).toContain(OTHER_JOB_ROLE);
    expect(PREDEFINED_JOB_ROLES).not.toContain(OTHER_JOB_ROLE);
  });

  it("persists the custom Other value instead of the literal Other", () => {
    expect(
      toPersistedJobRoles(["Bartender", "Dancer"], true, "Model")
    ).toEqual(["Bartender", "Dancer", "Model"]);
  });

  it("reloads a stored custom role as Other", () => {
    const split = splitStoredJobRoles(["Bartender", "Model"]);
    expect(split.predefined).toEqual(["Bartender"]);
    expect(split.customRole).toBe("Model");
    expect(split.otherSelected).toBe(true);
  });

  it("preserves a literal Other record as Other with an empty custom value", () => {
    const split = splitStoredJobRoles(["Bartender", "Other"]);
    expect(split.predefined).toEqual(["Bartender"]);
    expect(split.customRole).toBe("");
    expect(split.otherSelected).toBe(true);
  });

  it("rejects a custom role that is too long", () => {
    const result = normalizeAndValidateJobRoles({
      jobRoles: ["Other"],
      customJobRole: "A".repeat(41),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/40 characters or fewer/);
    }
  });

  it("rejects profanity in a custom role", () => {
    const result = normalizeAndValidateJobRoles({
      jobRoles: ["Other"],
      customJobRole: "fucking dancer",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(PROFANITY_BLOCKED_MESSAGE);
    }
  });

  it("rejects contact details in a custom role", () => {
    const result = normalizeAndValidateJobRoles({
      jobRoles: ["Other"],
      customJobRole: "LINE: abc123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(CONTACT_CIRCUMVENTION_MESSAGE);
    }
  });

  it("rejects excessive role arrays", () => {
    const result = normalizeAndValidateJobRoles({
      jobRoles: Array.from({ length: MAX_JOB_ROLES + 1 }, (_, index) =>
        index === 0 ? "CustomRole" : PREDEFINED_JOB_ROLES[index - 1]
      ),
    });
    expect(result.ok).toBe(false);
  });
});
