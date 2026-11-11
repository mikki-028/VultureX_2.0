import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "./config";

// Throws a clear configuration error when DATABASE_URL is missing or invalid.
// Without this, `postgres()` silently falls back to localhost:5432 and every
// query fails at runtime with ECONNREFUSED 127.0.0.1:5432.
const connectionString = resolveDatabaseUrl();

// Serverless: 1 connection per invocation, no prepare for pooled connections
const client = postgres(connectionString, {
  prepare: false,
  max: 1,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
