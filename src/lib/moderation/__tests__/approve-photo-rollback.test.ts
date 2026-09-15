import { describe, expect, it, vi } from "vitest";
import { persistApprovedPhotoOrRollbackPublicObject } from "../photo-moderation";

describe("persistApprovedPhotoOrRollbackPublicObject", () => {
  it("deletes the promoted public object when the database persist fails", async () => {
    const rollback = vi.fn(async () => undefined);

    const result = await persistApprovedPhotoOrRollbackPublicObject(
      async () => {
        throw new Error("db write failed");
      },
      "profiles/u1/promoted.jpg",
      rollback
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Could not approve photo");
    expect(rollback).toHaveBeenCalledWith("profiles/u1/promoted.jpg");
  });

  it("does not roll back when the database persist succeeds", async () => {
    const rollback = vi.fn(async () => undefined);

    const result = await persistApprovedPhotoOrRollbackPublicObject(
      async () => undefined,
      "profiles/u1/promoted.jpg",
      rollback
    );

    expect(result.success).toBe(true);
    expect(rollback).not.toHaveBeenCalled();
  });
});
