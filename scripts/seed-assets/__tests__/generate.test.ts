import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generateFaceJpg,
  generateIdCardJpg,
  generateLogoPng,
  generateLivenessClip,
} from "../generate";
import sharp from "sharp";

describe("seed asset generators", () => {
  let tmp = "";

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seed-assets-"));
  });

  afterAll(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("generates face jpg at 800x1000", async () => {
    const out = path.join(tmp, "face.jpg");
    await generateFaceJpg(1, "Somchai", out);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(1000);
    expect(meta.format).toBe("jpeg");
  });

  it("generates logo png at 512x512", async () => {
    const out = path.join(tmp, "logo.png");
    await generateLogoPng(1, "SB", out);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    expect(meta.format).toBe("png");
  });

  it("generates sample id card 1000x630", async () => {
    const out = path.join(tmp, "id.jpg");
    await generateIdCardJpg(out);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1000);
    expect(meta.height).toBe(630);
  });

  it("generates liveness mp4 when ffmpeg is available", () => {
    const out = path.join(tmp, "live.mp4");
    const result = generateLivenessClip(out, "mp4");
    if (!result.ok) {
      // Skip when neither PATH ffmpeg nor ffmpeg-static works in CI.
      expect(result.reason).toMatch(/ffmpeg/i);
      return;
    }
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.statSync(out).size).toBeGreaterThan(1000);
  });
});