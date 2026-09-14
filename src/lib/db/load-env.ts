import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

const root = process.cwd();
const presetKeys = new Set(Object.keys(process.env));

function loadEnvFile(filePath: string, overrideNonPreset: boolean): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const parsed = dotenv.parse(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (presetKeys.has(key)) {
      continue;
    }
    if (overrideNonPreset || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(root, ".env"), false);
loadEnvFile(path.resolve(root, ".env.local"), true);
