// Shared configuration for the local/staging QA harness.
//
// This repository stores no secrets. Every credential is read from the
// environment, and a missing value stops the script before any request is
// made so a half-configured run can never fall back to a baked-in default.

export function requireEnv(name, hint) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`Missing required environment variable: ${name}`);
    if (hint) console.error(`  expected: ${hint}`);
    console.error("Export it in your shell (or a gitignored env file) before running this script.");
    process.exit(1);
  }
  return value.trim();
}

/** Connection string for the disposable database these scripts target. */
export function databaseUrl() {
  return requireEnv("DATABASE_URL", "postgresql://user:password@host:5432/database");
}

/**
 * Connection string for the disposable LOCAL cluster. Kept separate from
 * DATABASE_URL on purpose: the scripts that create and drop databases use this
 * one, so a production DATABASE_URL can never be the target of a DROP DATABASE.
 */
export function localDatabaseUrl() {
  return requireEnv(
    "VX_LOCAL_DATABASE_URL",
    "a disposable local cluster, e.g. postgresql://postgres@127.0.0.1:55432/postgres",
  );
}

/** Password for throwaway QA accounts created by the harness. */
export function testPassword() {
  return requireEnv("VX_TEST_PASSWORD", "a password used only for disposable QA accounts");
}

/** Credentials of an existing admin account used to drive admin-only flows. */
export function adminCreds() {
  return {
    email: requireEnv("VX_TEST_ADMIN_EMAIL", "email of an existing admin account"),
    password: requireEnv("VX_TEST_ADMIN_PASSWORD", "password of that admin account"),
  };
}
