import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const port = 55432;
const databaseDir = path.resolve(".local-test-db/pgdata");

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
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
