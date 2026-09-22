import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import enMessages from "../../../../../messages/en.json";

const SRC_ROOT = path.join(process.cwd(), "src");

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relativePath), "utf8");
}

describe("worker verification flow security (source)", () => {
  const pageSource = readSrc("app/worker/verification/page.tsx");
  const recorderSource = readSrc(
    "components/verification/LiveLivenessRecorder.tsx"
  );
  const livenessSource = readSrc("lib/verification/liveness-recording.ts");
  const challengeSource = readSrc(
    "app/api/worker/verification/challenge/route.ts"
  );
  const uploadSource = readSrc("app/api/worker/verification/upload/route.ts");
  const submitSource = readSrc("app/api/worker/verification/route.ts");

  it("starts the worker on an ID-first step, not video", () => {
    expect(pageSource).toMatch(/useState<VerificationStep>\("id"\)/);
    expect(pageSource).toContain('t("heading")');
    expect(pageSource).toContain('t("stepOf"');
    expect(pageSource).toContain('t("uploadIdTitle")');
    expect(enMessages.worker.verificationFlow.heading).toBe("Verify your identity");
    expect(enMessages.worker.verificationFlow.stepOf).toBe("Step {current} of {total}");
    expect(enMessages.worker.verificationFlow.uploadIdTitle).toBe("Upload your ID");
    expect(pageSource).not.toContain("Start video");
    expect(pageSource).not.toContain("Verify it's you");
    expect(pageSource).not.toContain("Verify it&apos;s you");
  });

  it("does not fetch or display a challenge before ID upload", () => {
    expect(pageSource).not.toMatch(
      /fetchVerificationStatus\(\);\s*[\s\S]*fetchChallengeCode/
    );
    expect(pageSource).not.toMatch(
      /fetch\("\/api\/worker\/verification\/challenge"\)/
    );
    expect(pageSource).toContain('method: "POST"');
    expect(pageSource).toContain("idDocumentKey");
    expect(pageSource).toContain('t("continueToVideo")');
    expect(enMessages.worker.verificationFlow.continueToVideo).toBe(
      "Continue to video verification"
    );
    expect(challengeSource).toContain("idDocumentKey");
    expect(challengeSource).toContain("ID document must be uploaded");
  });

  it("does not offer a prerecorded video file picker in verification UI", () => {
    expect(pageSource).not.toMatch(/accept=["']video\//);
    expect(recorderSource).not.toMatch(/accept=["']video\//);
    expect(pageSource).not.toMatch(/<input[^>]*type=["']file["'][^>]*video/);
    expect(recorderSource).not.toMatch(/<input[^>]*type=["']file["']/);
    expect(pageSource).toMatch(
      /accept=["']image\/jpeg,image\/png,image\/webp["']/
    );
  });

  it("records liveness with getUserMedia and MediaRecorder instead of capture hints", () => {
    expect(pageSource).toContain("getUserMedia");
    expect(pageSource).toContain("LIVE_CAMERA_CONSTRAINTS");
    expect(livenessSource).toContain('facingMode: "user"');
    expect(livenessSource).toContain("audio: true");
    expect(recorderSource).toContain("MediaRecorder");
    expect(livenessSource).toContain("isTypeSupported");
    expect(pageSource).not.toMatch(/capture=["']/);
    expect(recorderSource).not.toMatch(/capture=["']/);
  });

  it("binds liveness upload to the current challenge and uploaded ID", () => {
    expect(uploadSource).toContain("canUploadLivenessVideo");
    expect(uploadSource).toContain("requestedIdDocumentKey");
    expect(submitSource).toContain("boundIdDocumentKey");
    expect(challengeSource).toContain("assertOwnedPrivateVerificationKey");
  });

  it("keeps worker-only authorization on verification APIs", () => {
    for (const source of [challengeSource, uploadSource, submitSource]) {
      expect(source).toContain("requireActiveWorker");
      expect(source).toContain("deniedActiveUserResponse");
    }
  });

  it("does not make ID or liveness public", () => {
    expect(uploadSource).toContain("generatePresignedIdUploadUrl");
    expect(uploadSource).toContain("generatePresignedLivenessVideoUploadUrl");
    expect(pageSource).not.toContain("S3_CDN_URL");
    expect(pageSource).not.toContain("getPublicUrl");
  });

  it("uses a separate playback video with no live stream after recording", () => {
    expect(recorderSource).toContain("LivePreviewVideo");
    expect(recorderSource).toContain("RecordedPlaybackVideo");
    expect(recorderSource).toContain("detachLivePreviewElement");
    expect(recorderSource).toContain("bindRecordedPlaybackElement");
    expect(recorderSource).toContain("stopMediaStream");
    expect(recorderSource).toContain("onReacquireCamera");
    expect(recorderSource).toContain('data-testid="liveness-playback"');
    expect(recorderSource).toContain('data-testid="liveness-live-preview"');
    expect(livenessSource).toContain("video.srcObject = null");
    expect(pageSource).toContain("handleReacquireCamera");
    expect(pageSource).toContain("getUserMedia");
  });

  it("allows camera and microphone on the verification page", () => {
    const config = fs.readFileSync(
      path.join(process.cwd(), "next.config.ts"),
      "utf8"
    );
    expect(config).toContain("/worker/verification");
    expect(config).toContain("Permissions-Policy");
    expect(config).toContain("camera=(self)");
    expect(config).toContain("microphone=(self)");
  });
});
