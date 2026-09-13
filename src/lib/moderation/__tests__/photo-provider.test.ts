import { describe, it, expect, beforeEach } from "vitest";
import {
  StubPhotoModerationProvider,
  AWSRekognitionProvider,
  setPhotoModerationProvider,
  getPhotoModerationProvider,
  analyzeProfilePhoto,
} from "../photo-provider";

describe("photo-provider", () => {
  describe("StubPhotoModerationProvider", () => {
    let provider: StubPhotoModerationProvider;

    beforeEach(() => {
      provider = new StubPhotoModerationProvider();
    });

    it("should have name set to stub", () => {
      expect(provider.name).toBe("stub");
    });

    it("should return safe result by default", async () => {
      const result = await provider.analyzeImage("https://example.com/image.jpg");

      expect(result.categories).toContain("safe");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should return explicit result when scenario is explicit", async () => {
      provider.setScenario("explicit");
      const result = await provider.analyzeImage("https://example.com/image.jpg");

      expect(result.categories).toContain("explicit_nudity");
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("should return lingerie result when scenario is lingerie", async () => {
      provider.setScenario("lingerie");
      const result = await provider.analyzeImage("https://example.com/image.jpg");

      expect(result.categories).toContain("lingerie_swimwear");
      expect(result.categories).toContain("suggestive");
    });

    it("should return ambiguous result when scenario is ambiguous", async () => {
      provider.setScenario("ambiguous");
      const result = await provider.analyzeImage("https://example.com/image.jpg");

      expect(result.categories).toContain("unknown");
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe("AWSRekognitionProvider", () => {
    it("should have name set to aws-rekognition", () => {
      const provider = new AWSRekognitionProvider();
      expect(provider.name).toBe("aws-rekognition");
    });

    it("should report not configured when no credentials", () => {
      const provider = new AWSRekognitionProvider({
        accessKeyId: "",
        secretAccessKey: "",
      });
      expect(provider.isConfigured()).toBe(false);
    });

    it("should report configured when credentials provided", () => {
      const provider = new AWSRekognitionProvider({
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
      });
      expect(provider.isConfigured()).toBe(true);
    });

    it("should fall back to stub when not configured", async () => {
      const provider = new AWSRekognitionProvider({
        accessKeyId: "",
        secretAccessKey: "",
      });

      const result = await provider.analyzeImage("https://example.com/image.jpg");

      expect(result.categories).toContain("safe");
    });
  });

  describe("provider management", () => {
    beforeEach(() => {
      setPhotoModerationProvider(new StubPhotoModerationProvider());
    });

    it("should get the current provider", () => {
      const provider = getPhotoModerationProvider();
      expect(provider.name).toBe("stub");
    });

    it("should allow setting a different provider", () => {
      const customProvider = new StubPhotoModerationProvider();
      customProvider.setScenario("explicit");
      setPhotoModerationProvider(customProvider);

      const current = getPhotoModerationProvider();
      expect(current).toBe(customProvider);
    });

    it("should use current provider for analyzeProfilePhoto", async () => {
      const provider = new StubPhotoModerationProvider();
      provider.setScenario("lingerie");
      setPhotoModerationProvider(provider);

      const result = await analyzeProfilePhoto("https://example.com/image.jpg");

      expect(result.categories).toContain("lingerie_swimwear");
    });
  });

  describe("analyzeProfilePhoto", () => {
    it("should return analysis result from current provider", async () => {
      const provider = new StubPhotoModerationProvider();
      setPhotoModerationProvider(provider);

      const result = await analyzeProfilePhoto("https://example.com/test.jpg");

      expect(result).toHaveProperty("categories");
      expect(result).toHaveProperty("confidence");
    });

    it("should include raw labels when available", async () => {
      const provider = new StubPhotoModerationProvider();
      setPhotoModerationProvider(provider);

      const result = await analyzeProfilePhoto("https://example.com/test.jpg");

      expect(result.rawLabels).toBeDefined();
      expect(Array.isArray(result.rawLabels)).toBe(true);
    });
  });
});
