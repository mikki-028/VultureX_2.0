/**
 * Database connection configuration.
 *
 * The application has exactly one database, reached over the single
 * `DATABASE_URL` variable:
 *
 *   Next.js route handler / server component
 *     -> drizzle-orm/postgres-js
 *     -> postgres-js
 *     -> DATABASE_URL (direct Postgres, company Supabase project)
 *
 * There is deliberately no localhost fallback. `postgres()` on its own falls
 * back to `localhost:5432` when it receives no connection string, which in a
 * deployment surfaces as `ECONNREFUSED 127.0.0.1:5432` on the first query.
 * A missing variable is a configuration error, so it is reported as one.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

/**
 * Validates and returns the configured PostgreSQL connection string.
 *
 * @throws {DatabaseConfigError} when the variable is missing, malformed, not a
 * PostgreSQL URL, or points at a loopback host on a Vercel deployment.
 */
export function resolveDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.DATABASE_URL?.trim();

  if (!raw) {
    throw new DatabaseConfigError(
      [
        "DATABASE_URL is not set.",
        "The app connects to PostgreSQL through Drizzle and needs the company",
        "Supabase pooler connection string:",
        "  DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres",
        "Set it in the Vercel Production environment (and in .env.local locally).",
        "There is deliberately no localhost fallback.",
      ].join("\n"),
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new DatabaseConfigError(
      "DATABASE_URL is not a valid URL. It must be a PostgreSQL connection string.",
    );
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new DatabaseConfigError(
      `DATABASE_URL must use the postgres:// or postgresql:// scheme (received "${parsed.protocol}//"). ` +
        "A Supabase project URL or publishable key is not a database connection string.",
    );
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) {
    throw new DatabaseConfigError("DATABASE_URL has no host.");
  }

  // On a real deployment a loopback host always points at the build machine,
  // never at the company database, so treat it as a hard configuration error.
  // Local development may still configure it explicitly (see the test suite).
  const isDeployment = env.VERCEL === "1";
  if (isDeployment && LOOPBACK_HOSTS.has(host)) {
    throw new DatabaseConfigError(
      `DATABASE_URL points at ${host}, which is unreachable from a Vercel deployment. ` +
        "Set the Production DATABASE_URL to the company Supabase pooler string.",
    );
  }

  return raw;
}
