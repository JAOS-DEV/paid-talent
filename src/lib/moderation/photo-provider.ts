import type { PhotoAnalysisResult, PhotoContentCategory } from "./photo-policy";

export interface PhotoModerationProvider {
  name: string;
  analyzeImage(imageUrl: string): Promise<PhotoAnalysisResult>;
}

export class StubPhotoModerationProvider implements PhotoModerationProvider {
  name = "stub";
  private scenario: "safe" | "explicit" | "lingerie" | "ambiguous" = "safe";

  setScenario(scenario: "safe" | "explicit" | "lingerie" | "ambiguous"): void {
    this.scenario = scenario;
  }

  async analyzeImage(_imageUrl: string): Promise<PhotoAnalysisResult> {
    console.log(`[Stub Photo Moderation] Analyzing with scenario: ${this.scenario}`);

    switch (this.scenario) {
      case "explicit":
        return {
          categories: ["explicit_nudity"],
          confidence: 0.95,
          rawLabels: ["nudity", "explicit"],
        };
      case "lingerie":
        return {
          categories: ["lingerie_swimwear", "suggestive"],
          confidence: 0.85,
          rawLabels: ["lingerie", "swimwear"],
        };
      case "ambiguous":
        return {
          categories: ["unknown"],
          confidence: 0.5,
          rawLabels: ["unclear"],
        };
      case "safe":
      default:
        return {
          categories: ["safe"],
          confidence: 0.92,
          rawLabels: ["person", "face", "portrait"],
        };
    }
  }
}

export class AWSRekognitionProvider implements PhotoModerationProvider {
  name = "aws-rekognition";
  private accessKeyId: string;
  private secretAccessKey: string;
  private region: string;

  constructor(config?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
  }) {
    this.accessKeyId =
      config?.accessKeyId || process.env.AWS_REKOGNITION_ACCESS_KEY_ID || "";
    this.secretAccessKey =
      config?.secretAccessKey ||
      process.env.AWS_REKOGNITION_SECRET_ACCESS_KEY ||
      "";
    this.region =
      config?.region || process.env.AWS_REKOGNITION_REGION || "us-east-1";
  }

  isConfigured(): boolean {
    return Boolean(this.accessKeyId && this.secretAccessKey);
  }

  async analyzeImage(imageUrl: string): Promise<PhotoAnalysisResult> {
    if (!this.isConfigured()) {
      console.warn(
        "[AWS Rekognition] Not configured, falling back to stub provider"
      );
      const stub = new StubPhotoModerationProvider();
      return stub.analyzeImage(imageUrl);
    }

    console.log("[AWS Rekognition] Analyzing staged profile photo");
    
    const categories: PhotoContentCategory[] = [];
    let confidence = 0.9;
    const rawLabels: string[] = [];

    try {
      const response = await fetch(imageUrl);
      const imageBuffer = await response.arrayBuffer();
      const imageBytes = Buffer.from(imageBuffer).toString("base64");

      const rekognitionEndpoint = `https://rekognition.${this.region}.amazonaws.com`;

      const moderationResponse = await this.callRekognition(
        rekognitionEndpoint,
        "DetectModerationLabels",
        {
          Image: { Bytes: imageBytes },
          MinConfidence: 50,
        }
      );

      if (moderationResponse.ModerationLabels) {
        for (const label of moderationResponse.ModerationLabels) {
          rawLabels.push(label.Name);
          confidence = Math.max(confidence, (label.Confidence || 0) / 100);

          const category = this.mapRekognitionLabel(label.Name);
          if (category && !categories.includes(category)) {
            categories.push(category);
          }
        }
      }

      if (categories.length === 0) {
        categories.push("safe");
      }

      return { categories, confidence, rawLabels };
    } catch (error) {
      console.error("[AWS Rekognition] Error:", error);
      return {
        categories: ["unknown"],
        confidence: 0,
        rawLabels: [],
      };
    }
  }

  private mapRekognitionLabel(label: string): PhotoContentCategory | null {
    const labelLower = label.toLowerCase();

    if (
      labelLower.includes("explicit nudity") ||
      labelLower.includes("graphic nudity") ||
      labelLower.includes("sexual activity")
    ) {
      return "explicit_nudity";
    }

    if (
      labelLower.includes("suggestive") ||
      labelLower.includes("revealing clothes")
    ) {
      return "suggestive";
    }

    if (
      labelLower.includes("swimwear") ||
      labelLower.includes("underwear") ||
      labelLower.includes("lingerie")
    ) {
      return "lingerie_swimwear";
    }

    if (labelLower.includes("violence") || labelLower.includes("graphic")) {
      return "violence";
    }

    if (labelLower.includes("hate") || labelLower.includes("extremist")) {
      return "hate_symbols";
    }

    if (labelLower.includes("drug") || labelLower.includes("pills")) {
      return "drugs";
    }

    return null;
  }

  private async callRekognition(
    endpoint: string,
    action: string,
    body: Record<string, unknown>
  ): Promise<{ ModerationLabels?: Array<{ Name: string; Confidence?: number }> }> {
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = timestamp.slice(0, 8);

    const headers: Record<string, string> = {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `RekognitionService.${action}`,
      "X-Amz-Date": timestamp,
      Host: new URL(endpoint).host,
    };

    const bodyString = JSON.stringify(body);

    const signature = await this.signRequest(
      "POST",
      "/",
      headers,
      bodyString,
      date,
      timestamp
    );

    headers["Authorization"] = signature;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: bodyString,
    });

    if (!response.ok) {
      throw new Error(`Rekognition API error: ${response.status}`);
    }

    return response.json();
  }

  private async signRequest(
    method: string,
    path: string,
    headers: Record<string, string>,
    body: string,
    date: string,
    timestamp: string
  ): Promise<string> {
    const service = "rekognition";
    const algorithm = "AWS4-HMAC-SHA256";
    const scope = `${date}/${this.region}/${service}/aws4_request`;

    const canonicalHeaders = Object.entries(headers)
      .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
      .join("\n");

    const signedHeaders = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort()
      .join(";");

    const bodyHash = await this.sha256(body);
    const canonicalRequest = [
      method,
      path,
      "",
      canonicalHeaders,
      "",
      signedHeaders,
      bodyHash,
    ].join("\n");

    const requestHash = await this.sha256(canonicalRequest);
    const stringToSign = [algorithm, timestamp, scope, requestHash].join("\n");

    const signingKey = await this.getSigningKey(date, service);
    const signature = await this.hmacHex(signingKey, stringToSign);

    return `${algorithm} Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  private async sha256(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private async hmac(key: BufferSource, message: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  }

  private async hmacHex(key: BufferSource, message: string): Promise<string> {
    const result = await this.hmac(key, message);
    return Array.from(new Uint8Array(result))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private async getSigningKey(
    date: string,
    service: string
  ): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const kDate = await this.hmac(
      encoder.encode(`AWS4${this.secretAccessKey}`),
      date
    );
    const kRegion = await this.hmac(kDate, this.region);
    const kService = await this.hmac(kRegion, service);
    return this.hmac(kService, "aws4_request");
  }
}

let currentPhotoProvider: PhotoModerationProvider =
  new StubPhotoModerationProvider();

export function setPhotoModerationProvider(
  provider: PhotoModerationProvider
): void {
  currentPhotoProvider = provider;
}

export function getPhotoModerationProvider(): PhotoModerationProvider {
  return currentPhotoProvider;
}

export function initializePhotoModerationProvider(): void {
  const rekognition = new AWSRekognitionProvider();
  if (rekognition.isConfigured()) {
    console.log("[Photo Moderation] Using AWS Rekognition provider");
    setPhotoModerationProvider(rekognition);
  } else {
    console.log(
      "[Photo Moderation] AWS Rekognition not configured, using stub provider"
    );
    console.log(
      "[Photo Moderation] Set AWS_REKOGNITION_ACCESS_KEY_ID and AWS_REKOGNITION_SECRET_ACCESS_KEY to enable"
    );
  }
}

export async function analyzeProfilePhoto(
  imageUrl: string
): Promise<PhotoAnalysisResult> {
  return currentPhotoProvider.analyzeImage(imageUrl);
}
