import { localDatabaseUrl } from "./config.mjs";
import postgres from "postgres";

const admin = postgres(localDatabaseUrl(), {
  max: 1,
  prepare: false,
});

try {
  await admin.unsafe("DROP DATABASE IF EXISTS vulturex WITH (FORCE)");
  await admin.unsafe(
    "CREATE DATABASE vulturex WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'"
  );
  const rows = await admin`
    select datname, pg_encoding_to_char(encoding) as enc
    from pg_database where datname = 'vulturex'
  `;
  console.log("database:", JSON.stringify(rows[0]));
} catch (error) {
  console.error("SETUP ERROR:", error.message);
  process.exitCode = 1;
} finally {
  await admin.end({ timeout: 2 });
}
