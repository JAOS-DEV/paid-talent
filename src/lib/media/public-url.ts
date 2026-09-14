export const PUBLIC_MEDIA_CDN_REQUIRED = "PUBLIC_MEDIA_CDN_REQUIRED";

export class PublicMediaConfigError extends Error {
  readonly code: typeof PUBLIC_MEDIA_CDN_REQUIRED = PUBLIC_MEDIA_CDN_REQUIRED;

  constructor(
    message = "S3_CDN_URL is required for Cloudflare R2 public media"
  ) {
    super(message);
    this.name = "PublicMediaConfigError";
  }
}

export interface PublicMediaEnv {
  cdnUrl?: string | null;
  endpoint?: string | null;
  bucketName?: string | null;
  region?: string | null;
}

function trimSlashEnd(value: string): string {
  return value.replace(/\/+$/, "");
}

function trimSlashStart(value: string): string {
  return value.replace(/^\/+/, "");
}

export function joinPublicMediaUrl(base: string, key: string): string {
  return `${trimSlashEnd(base)}/${trimSlashStart(key)}`;
}

export function isR2S3ApiHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "r2.cloudflarestorage.com" ||
    host.endsWith(".r2.cloudflarestorage.com")
  );
}

export function isR2S3ApiEndpoint(endpoint: string): boolean {
  try {
    return isR2S3ApiHostname(new URL(endpoint).hostname);
  } catch {
    return false;
  }
}

export function isPersistablePublicMediaUrl(urlString: string): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  if (isR2S3ApiHostname(url.hostname)) {
    return false;
  }

  if (
    url.searchParams.has("X-Amz-Signature") ||
    url.searchParams.has("X-Amz-Credential")
  ) {
    return false;
  }

  return true;
}

function parseHttpUrl(value: string, label: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new PublicMediaConfigError(`${label} is not a valid URL`);
  }
}

export function resolvePublicMediaBaseUrl(env: PublicMediaEnv): string {
  const cdnUrl = env.cdnUrl?.trim();
  if (cdnUrl) {
    const parsed = parseHttpUrl(cdnUrl, "S3_CDN_URL");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new PublicMediaConfigError("S3_CDN_URL must be an http(s) URL");
    }
    if (isR2S3ApiHostname(parsed.hostname)) {
      throw new PublicMediaConfigError(
        "S3_CDN_URL cannot be the R2 S3 API endpoint"
      );
    }
    return trimSlashEnd(cdnUrl);
  }

  const endpoint = env.endpoint?.trim();
  if (endpoint && isR2S3ApiEndpoint(endpoint)) {
    throw new PublicMediaConfigError(
      "S3_CDN_URL is required when using Cloudflare R2. The S3 API endpoint is not a public browser URL."
    );
  }

  if (endpoint) {
    const bucket = env.bucketName?.trim() || "paid-talent-media";
    return joinPublicMediaUrl(endpoint, bucket);
  }

  const bucket = env.bucketName?.trim() || "paid-talent-media";
  const region = env.region?.trim() || "us-east-1";
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}

export function buildPublicMediaUrl(key: string, env: PublicMediaEnv): string {
  return joinPublicMediaUrl(resolvePublicMediaBaseUrl(env), key);
}
