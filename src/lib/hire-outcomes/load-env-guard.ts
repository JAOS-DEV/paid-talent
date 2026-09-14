import "../db/load-env";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

let host = "";
try {
  host = new URL(url).hostname.toLowerCase();
} catch {
  throw new Error("DATABASE_URL is not a valid URL");
}

if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  throw new Error("Refusing to run local DB validation against a non-localhost host");
}

console.log(`LOCAL_DB_HOST=${host}`);
