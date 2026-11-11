import { localDatabaseUrl, testPassword } from "./config.mjs";
import bcrypt from "bcryptjs";
import postgres from "postgres";

const sql = postgres(localDatabaseUrl(), {
  max: 1,
  prepare: false,
});
const email = "qa.admin.staging@vulturex.test";
const passwordHash = await bcrypt.hash(testPassword(), 12);
await sql`
  insert into users (email, name, password_hash, role, email_verified)
  values (${email}, ${"QA Staging Admin"}, ${passwordHash}, ${"admin"}, true)
  on conflict (email) do update
    set password_hash = excluded.password_hash, role = excluded.role, email_verified = true
`;
console.log("staging admin ready:", email);
await sql.end({ timeout: 2 });
