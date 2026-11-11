import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const port = 55432;
const databaseDir = path.resolve(".local-test-db/pgdata");

// The disposable local cluster password is never stored in the repository.
const password = process.env.VX_LOCAL_PG_PASSWORD;
if (!password) {
  console.error("Missing required environment variable: VX_LOCAL_PG_PASSWORD");
  console.error("  expected: any throwaway password for the local Postgres cluster");
  process.exit(1);
}

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password,
  port,
  persistent: true,
});

await pg.initialise();
await pg.start();
console.log("postgres started on", port);

try {
  await pg.createDatabase("vulturex");
  console.log("database vulturex created");
} catch (error) {
  console.log("createDatabase skipped:", error.message);
}

console.log("PG_READY");
setInterval(() => {}, 1 << 30);
