import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseConfigError, resolveDatabaseUrl } from "./config";

const REMOTE =
  "postgresql://postgres.abcdefghijklmnop:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres";
const LOCAL = "postgresql://postgres:pw@127.0.0.1:55432/vulturex";

test("returns the configured connection string unchanged", () => {
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: REMOTE }), REMOTE);
});

test("throws a configuration error when DATABASE_URL is missing or blank", () => {
  assert.throws(() => resolveDatabaseUrl({}), DatabaseConfigError);
  assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: "   " }), /DATABASE_URL is not set/);
});

test("never falls back to localhost when the variable is absent", () => {
  assert.throws(() => resolveDatabaseUrl({}), /no localhost fallback/i);
});

test("rejects a malformed URL", () => {
  assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: "not-a-url" }), /not a valid URL/);
});

test("rejects a Supabase project URL or publishable key used by mistake", () => {
  assert.throws(
    () => resolveDatabaseUrl({ DATABASE_URL: "https://abcdefghijklmnop.supabase.co" }),
    /postgres:\/\/ or postgresql:\/\//,
  );
  assert.throws(
    () => resolveDatabaseUrl({ DATABASE_URL: "https://pooler.supabase.com:6543/postgres" }),
    /not a database connection string/,
  );
});

test("rejects a loopback host on a Vercel deployment", () => {
  for (const host of ["127.0.0.1", "localhost", "0.0.0.0"]) {
    assert.throws(
      () => resolveDatabaseUrl({ DATABASE_URL: `postgresql://postgres:pw@${host}:5432/postgres`, VERCEL: "1" }),
      /unreachable from a Vercel deployment/,
      `expected ${host} to be rejected on Vercel`,
    );
  }
});

test("allows an explicitly configured local database during local development", () => {
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: LOCAL }), LOCAL);
});
