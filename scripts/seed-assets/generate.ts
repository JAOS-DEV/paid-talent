/**
 * Generates local seed media into .seed-assets/ (gitignored).
 * Idempotent: skips files that already exist.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const SEED_ASSETS_DIR = path.join(process.cwd(), ".seed-assets");
export const SEED_CHALLENGE_CODE = "123456";

const FACE_COLORS = [
  "#F6C1C0",
  "#C5E1A5",
  "#90CAF9",
  "#FFE082",
  "#CE93D8",
  "#80CBC4",
  "#FFAB91",
  "#B0BEC5",
];

const LOGO_COLORS = [
  "#1B4332",
  "#9B2226",
  "#0D3B66",
  "#7B2CBF",
  "#BC6C25",
  "#2A9D8F",
];

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function resolveFfmpegBin(): string | null {
  const fromPath = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (fromPath.status === 0) return "ffmpeg";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticBin = require("ffmpeg-static") as string | null;
    return staticBin || null;
  } catch {
    return null;
  }
}

export async function generateFaceJpg(
  index: number,
  label: string,
  outPath: string
): Promise<void> {
  if (fs.existsSync(outPath)) return;
  const bg = FACE_COLORS[(index - 1) % FACE_COLORS.length];
  const svg = `
    <svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="1000" fill="${bg}"/>
      <circle cx="400" cy="340" r="140" fill="#F5F5F5" opacity="0.9"/>
      <ellipse cx="400" cy="720" rx="220" ry="180" fill="#F5F5F5" opacity="0.9"/>
      <text x="400" y="940" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="48" font-weight="700" fill="#212121">${escapeXml(label)}</text>
    </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(outPath);
}

export async function generateLogoPng(
  index: number,
  initials: string,
  outPath: string
): Promise<void> {
  if (fs.existsSync(outPath)) return;
  const bg = LOGO_COLORS[(index - 1) % LOGO_COLORS.length];
  const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="64" fill="${bg}"/>
      <text x="256" y="290" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="160" font-weight="700" fill="#FFFFFF">${escapeXml(initials)}</text>
    </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outPath);
}

export async function generateIdCardJpg(outPath: string): Promise<void> {
  if (fs.existsSync(outPath)) return;
  const svg = `
    <svg width="1000" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1000" height="630" fill="#ECEFF1"/>
      <rect x="40" y="40" width="920" height="550" rx="16" fill="#FFFFFF" stroke="#90A4AE" stroke-width="4"/>
      <text x="500" y="100" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="36" font-weight="700" fill="#B71C1C">SAMPLE ID - NOT A REAL DOCUMENT</text>
      <rect x="80" y="160" width="220" height="280" fill="#CFD8DC"/>
      <text x="340" y="220" font-family="Arial, sans-serif" font-size="28" fill="#263238">Name: Seed Worker</text>
      <text x="340" y="280" font-family="Arial, sans-serif" font-size="28" fill="#263238">ID No: TH-SEED-1234</text>
      <text x="340" y="340" font-family="Arial, sans-serif" font-size="28" fill="#263238">Country: TH</text>
      <text x="340" y="400" font-family="Arial, sans-serif" font-size="24" fill="#546E7A">For local QA only</text>
    </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(outPath);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateLivenessClip(
  outPath: string,
  format: "mp4" | "webm"
): { ok: true } | { ok: false; reason: string } {
  if (fs.existsSync(outPath)) return { ok: true };
  const ffmpeg = resolveFfmpegBin();
  if (!ffmpeg) {
    return { ok: false, reason: "ffmpeg not available" };
  }

  const codecArgs =
    format === "mp4"
      ? ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "baseline", "-c:a", "aac"]
      : ["-c:v", "libvpx", "-b:v", "400k", "-c:a", "libvorbis"];

  const withDrawText = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=320x240:rate=15",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=3",
    "-vf",
    `drawtext=text='SEED ${SEED_CHALLENGE_CODE}':fontsize=24:fontcolor=white:x=20:y=20`,
    "-t",
    "3",
    ...codecArgs,
    "-shortest",
    outPath,
  ];

  let result = spawnSync(ffmpeg, withDrawText, { encoding: "utf8" });
  if (result.status !== 0) {
    const withoutDrawText = [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=320x240:rate=15",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=3",
      "-t",
      "3",
      ...codecArgs,
      "-shortest",
      outPath,
    ];
    result = spawnSync(ffmpeg, withoutDrawText, { encoding: "utf8" });
  }

  if (result.status !== 0 || !fs.existsSync(outPath)) {
    return {
      ok: false,
      reason: result.stderr?.slice(0, 400) || "ffmpeg failed",
    };
  }
  return { ok: true };
}

export interface GeneratedSeedAssets {
  faces: string[];
  logos: string[];
  idCard: string;
  livenessMp4: string | null;
  livenessWebm: string | null;
}

export async function generateAllSeedAssets(
  faceLabels: string[] = [
    "Somchai",
    "Nattaya",
    "Preecha",
    "Araya",
    "Tanawat",
    "Mayuree",
    "Kittipong",
    "Pornpan",
  ],
  logoInitials: string[] = ["TB", "SB", "SR", "RQ", "RL", "PT"]
): Promise<GeneratedSeedAssets> {
  ensureDir(SEED_ASSETS_DIR);
  const faces: string[] = [];
  for (let i = 0; i < 8; i++) {
    const out = path.join(SEED_ASSETS_DIR, `face-${i + 1}.jpg`);
    await generateFaceJpg(i + 1, faceLabels[i] ?? `W${i + 1}`, out);
    faces.push(out);
  }

  const logos: string[] = [];
  for (let i = 0; i < 6; i++) {
    const out = path.join(SEED_ASSETS_DIR, `logo-${i + 1}.png`);
    await generateLogoPng(i + 1, logoInitials[i] ?? `V${i + 1}`, out);
    logos.push(out);
  }

  const idCard = path.join(SEED_ASSETS_DIR, "id-card.jpg");
  await generateIdCardJpg(idCard);

  const livenessMp4Path = path.join(SEED_ASSETS_DIR, "liveness.mp4");
  const livenessWebmPath = path.join(SEED_ASSETS_DIR, "liveness.webm");
  const mp4 = generateLivenessClip(livenessMp4Path, "mp4");
  const webm = generateLivenessClip(livenessWebmPath, "webm");

  return {
    faces,
    logos,
    idCard,
    livenessMp4: mp4.ok ? livenessMp4Path : null,
    livenessWebm: webm.ok ? livenessWebmPath : null,
  };
}

if (require.main === module) {
  void generateAllSeedAssets().then((assets) => {
    console.log("Seed assets ready:", {
      faces: assets.faces.length,
      logos: assets.logos.length,
      idCard: assets.idCard,
      livenessMp4: assets.livenessMp4,
      livenessWebm: assets.livenessWebm,
    });
  });
}
