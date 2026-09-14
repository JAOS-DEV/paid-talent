import { describe, expect, it } from "vitest";
import {
  canIssueChallengeCode,
  canUploadLivenessVideo,
} from "../challenge-lifecycle";

describe("canIssueChallengeCode", () => {
  it("allows unverified workers to receive a fresh challenge", () => {
    expect(canIssueChallengeCode("unverified").allowed).toBe(true);
  });

  it("allows rejected workers to receive a fresh challenge", () => {
    expect(canIssueChallengeCode("rejected").allowed).toBe(true);
  });

  it("blocks pending and verified workers", () => {
    expect(canIssueChallengeCode("pending").allowed).toBe(false);
    expect(canIssueChallengeCode("verified").allowed).toBe(false);
  });
});

describe("canUploadLivenessVideo", () => {
  const validIssuedAt = new Date();

  it("requires an uploaded ID before liveness upload", () => {
    const result = canUploadLivenessVideo({
      challengeCode: "123456",
      challengeIssuedAt: validIssuedAt,
      boundIdDocumentKey: null,
      requestedIdDocumentKey: "verification-docs/user-1/id.jpg",
    });
    expect(result.allowed).toBe(false);
    expect(result.errors.some((error) => error.includes("ID document"))).toBe(
      true
    );
  });

  it("requires a server-issued challenge", () => {
    const result = canUploadLivenessVideo({
      challengeCode: null,
      challengeIssuedAt: null,
      boundIdDocumentKey: "verification-docs/user-1/id.jpg",
      requestedIdDocumentKey: "verification-docs/user-1/id.jpg",
    });
    expect(result.allowed).toBe(false);
    expect(result.errors.some((error) => error.includes("challenge"))).toBe(
      true
    );
  });

  it("rejects expired challenges", () => {
    const expired = new Date();
    expired.setMinutes(expired.getMinutes() - 31);
    const result = canUploadLivenessVideo({
      challengeCode: "123456",
      challengeIssuedAt: expired,
      boundIdDocumentKey: "verification-docs/user-1/id.jpg",
      requestedIdDocumentKey: "verification-docs/user-1/id.jpg",
    });
    expect(result.allowed).toBe(false);
    expect(result.errors.some((error) => error.includes("expired"))).toBe(true);
  });

  it("rejects a liveness upload bound to a different ID key", () => {
    const result = canUploadLivenessVideo({
      challengeCode: "123456",
      challengeIssuedAt: validIssuedAt,
      boundIdDocumentKey: "verification-docs/user-1/id-a.jpg",
      requestedIdDocumentKey: "verification-docs/user-1/id-b.jpg",
    });
    expect(result.allowed).toBe(false);
    expect(result.errors.some((error) => error.includes("same ID"))).toBe(true);
  });

  it("requires the client to send the uploaded ID key", () => {
    const result = canUploadLivenessVideo({
      challengeCode: "123456",
      challengeIssuedAt: validIssuedAt,
      boundIdDocumentKey: "verification-docs/user-1/id.jpg",
      requestedIdDocumentKey: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.errors.some((error) => error.includes("bound"))).toBe(true);
  });

  it("allows a live upload bound to the current unexpired challenge and ID", () => {
    const result = canUploadLivenessVideo({
      challengeCode: "123456",
      challengeIssuedAt: validIssuedAt,
      boundIdDocumentKey: "verification-docs/user-1/id.jpg",
      requestedIdDocumentKey: "verification-docs/user-1/id.jpg",
    });
    expect(result.allowed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
