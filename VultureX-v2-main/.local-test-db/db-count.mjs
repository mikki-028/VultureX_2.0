import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

try {
  const tables = await sql`
    select count(*)::int as c from information_schema.tables where table_schema = 'public'
  `;
  const cols = await sql`
    select count(*)::int as c from information_schema.columns where table_schema = 'public'
  `;
  const off = await sql`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'startups' and column_name in ('offerings','needs','target_customers')
  `;
  const journal = await sql`
    select count(*)::int as c from drizzle.__drizzle_migrations
  `.catch(() => [{ c: "no journal" }]);
  console.log(
    JSON.stringify({
      tables: tables[0].c,
      columns: cols[0].c,
      startupSignalColumns: off.map((r) => r.column_name),
      drizzleJournal: journal[0].c,
    })
  );
} catch (error) {
  console.error("COUNT ERROR:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 2 });
}
