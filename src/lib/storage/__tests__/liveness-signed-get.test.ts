import { describe, expect, it } from "vitest";
import { buildLivenessVideoGetObjectInput } from "@/lib/storage/s3";

describe("liveness signed GET object input", () => {
  it("sets ResponseContentType from the object key extension", () => {
    expect(
      buildLivenessVideoGetObjectInput(
        "verification-liveness/user-1/clip.webm",
        "private-bucket"
      )
    ).toEqual({
      Bucket: "private-bucket",
      Key: "verification-liveness/user-1/clip.webm",
      ResponseContentType: "video/webm",
    });

    expect(
      buildLivenessVideoGetObjectInput(
        "verification-liveness/user-1/clip.mp4",
        "private-bucket"
      )
    ).toMatchObject({
      ResponseContentType: "video/mp4",
    });

    expect(
      buildLivenessVideoGetObjectInput(
        "verification-liveness/user-1/clip.mov",
        "private-bucket"
      )
    ).toMatchObject({
      ResponseContentType: "video/quicktime",
    });
  });

  it("omits ResponseContentType when the extension is unknown", () => {
    expect(
      buildLivenessVideoGetObjectInput(
        "verification-liveness/user-1/clip",
        "private-bucket"
      )
    ).toEqual({
      Bucket: "private-bucket",
      Key: "verification-liveness/user-1/clip",
    });
  });
});
