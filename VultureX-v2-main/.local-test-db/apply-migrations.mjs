import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const dir = path.resolve("db/migrations");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

let applied = 0;
for (const file of files) {
  const body = fs.readFileSync(path.join(dir, file), "utf8");
  const statements = body
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i];
    try {
      await sql.unsafe(statement);
      applied += 1;
    } catch (error) {
      console.error(`FAILED ${file} statement ${i + 1}/${statements.length}`);
      console.error("code:", error.code);
      console.error("message:", error.message);
      console.error("statement:", statement.slice(0, 300).replace(/\s+/g, " "));
      await sql.end({ timeout: 2 });
      process.exit(1);
    }
  }
  console.log(`ok ${file} (${statements.length} statements)`);
}

console.log(`TOTAL statements applied: ${applied}`);
await sql.end({ timeout: 2 });
