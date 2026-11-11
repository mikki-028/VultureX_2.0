import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { resolveDatabaseUrl } from "./db/config";

// Match Next.js precedence: .env.local overrides .env. Without this, the CLI
// could not see a DATABASE_URL that only exists in .env.local.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Fails loudly when DATABASE_URL is absent instead of letting the CLI
    // fall back to localhost.
    url: resolveDatabaseUrl(),
  },
});
