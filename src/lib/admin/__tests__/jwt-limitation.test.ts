import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("admin JWT session limitation", () => {
  it("does not put database account-status checks into Edge middleware", () => {
    const middleware = fs.readFileSync(
      path.join(process.cwd(), "src/middleware.ts"),
      "utf8"
    );
    expect(middleware).not.toContain("accountStatus");
    expect(middleware).not.toContain("bannedIdentities");
    expect(middleware).not.toContain("@/lib/db");
  });

  it("documents that already-issued JWTs are not immediately revoked", () => {
    const moderation = fs.readFileSync(
      path.join(process.cwd(), "src/lib/admin/account-moderation.ts"),
      "utf8"
    );
    expect(moderation).toContain("unpublishRestrictedContent");
    expect(moderation).toContain(
      "The already-issued JWT itself is not forcibly invalidated at Edge"
    );
    expect(moderation).toContain(
      "DB-backed Node/server actions and APIs deny suspended/banned accounts"
    );
  });
});
