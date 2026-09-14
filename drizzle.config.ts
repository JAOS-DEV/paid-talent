import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://paidtalent:paidtalent@127.0.0.1:55440/paid_talent_dev",
  },
  verbose: true,
  strict: true,
});
