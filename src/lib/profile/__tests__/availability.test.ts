import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_OPTIONS,
  migrateScalarAvailability,
  normalizeAndValidateAvailability,
  availabilityMatchesFilter,
} from "../availability";

describe("availability", () => {
  it("migrates scalar production-style values to one-element arrays", () => {
    expect(migrateScalarAvailability(null)).toEqual([]);
    expect(migrateScalarAvailability("")).toEqual([]);
    expect(migrateScalarAvailability("   ")).toEqual([]);
    expect(migrateScalarAvailability("Full-time")).toEqual(["Full-time"]);
  });

  it("accepts multiple supported options and deduplicates them", () => {
    const result = normalizeAndValidateAvailability([
      "Full-time",
      "Part-time",
      "Full-time",
      "On-call",
    ]);
    expect(result).toEqual({
      ok: true,
      availability: ["Full-time", "Part-time", "On-call"],
    });
  });

  it("rejects arbitrary availability values", () => {
    const result = normalizeAndValidateAvailability([
      "Full-time",
      "made-up-value",
    ]);
    expect(result.ok).toBe(false);
  });

  it("requires at least one option", () => {
    expect(normalizeAndValidateAvailability([]).ok).toBe(false);
  });

  it("matches a recruiter filter against one member of a multi-value array", () => {
    expect(
      availabilityMatchesFilter(
        ["Full-time", "Part-time", "On-call"],
        "Part-time"
      )
    ).toBe(true);
    expect(
      availabilityMatchesFilter(["Full-time", "On-call"], "Part-time")
    ).toBe(false);
  });

  it("caps selections at the number of supported options", () => {
    expect(AVAILABILITY_OPTIONS).toHaveLength(6);
    const result = normalizeAndValidateAvailability([...AVAILABILITY_OPTIONS]);
    expect(result.ok).toBe(true);
  });
});
