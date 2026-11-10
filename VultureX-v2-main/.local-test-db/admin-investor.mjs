import fs from "node:fs";
import postgres from "postgres";

const base = "http://127.0.0.1:3000";

function cookieHeader(jarPath) {
  const raw = fs.readFileSync(jarPath, "utf8");
  const parts = [];
  for (let line of raw.split(/\r?\n/)) {
    if (line.startsWith("#HttpOnly_")) line = line.slice("#HttpOnly_".length);
    else if (!line || line.startsWith("#")) continue;
    const f = line.split("\t");
    if (f.length >= 7) parts.push(`${f[5]}=${f[6]}`);
  }
  return parts.join("; ");
}

const admin = cookieHeader(".local-test-db/cookies/asmita.txt");
const investor = cookieHeader(".local-test-db/cookies/investor.txt");
const startup = cookieHeader(".local-test-db/cookies/startup.txt");

const sql = postgres("postgres://postgres:postgres@127.0.0.1:55432/vulturex", { max: 1, prepare: false });
const comp = (await sql`select id, status, title from competitions order by created_at limit 1`)[0];
const startupRow = (await sql`select id, user_id from startups where slug='greenpath'`)[0];
const investorRow = (await sql`select id from investors where full_name ilike '%Michael%' limit 1`)[0];
await sql.end({ timeout: 2 });
console.log("competition:", comp.status, comp.title, comp.id);
console.log("startup:", startupRow.id, "| investor:", investorRow.id);

async function page(label, path, cookie) {
  const res = await fetch(base + path, { headers: { cookie }, redirect: "manual" });
  const text = await res.text();
  console.log(`${String(res.status).padEnd(4)} ${label}${res.status >= 500 ? " <-- ERROR" : ""}`);
  return res.status;
}

async function call(label, path, { cookie, method, body }) {
  const res = await fetch(base + path, {
    method,
    headers: { cookie, "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 100).replace(/\s+/g, " "); }
  console.log(`${String(res.status).padEnd(4)} ${label} :: ${JSON.stringify(parsed).slice(0, 260)}`);
  return { status: res.status, body: parsed };
}

console.log("\n===== ADMIN PAGES (asmita) =====");
await page("/admin", "/admin", admin);
await page("/admin/competitions", "/admin/competitions", admin);
await page(`/admin/competitions/${comp.id}`, `/admin/competitions/${comp.id}`, admin);
await page("/admin/pitch-decks", "/admin/pitch-decks", admin);
await page("/admin/impact", "/admin/impact", admin);

console.log("\n===== ADMIN AUTHORIZATION =====");
await page("startup -> /admin (expect redirect)", "/admin", startup);
await page("investor -> /admin (expect redirect)", "/admin", investor);
await call("startup -> admin competition API", `/api/admin/competitions/${comp.id}`, {
  cookie: startup, method: "PATCH", body: { action: "approve" },
});

console.log("\n===== ADMIN ACTIONS =====");
await call("invalid action", `/api/admin/competitions/${comp.id}`, {
  cookie: admin, method: "PATCH", body: { action: "bogus" },
});
await call("approve already-active competition", `/api/admin/competitions/${comp.id}`, {
  cookie: admin, method: "PATCH", body: { action: "approve" },
});
await call("publish active competition", `/api/admin/competitions/${comp.id}`, {
  cookie: admin, method: "PATCH", body: { action: "publish" },
});
await call("impact review unknown id", "/api/admin/impact/00000000-0000-4000-8000-000000000000", {
  cookie: admin, method: "POST", body: { action: "verified" },
});
await call("impact review bad action", "/api/admin/impact/00000000-0000-4000-8000-000000000000", {
  cookie: admin, method: "POST", body: { action: "nope" },
});
await call("pitch deck status unknown id", "/api/admin/pitch-deck/requests/00000000-0000-4000-8000-000000000000/status", {
  cookie: admin, method: "POST", body: { status: "in_progress" },
});
await call("pitch deck status as startup", "/api/admin/pitch-deck/requests/00000000-0000-4000-8000-000000000000/status", {
  cookie: startup, method: "POST", body: { status: "in_progress" },
});
await call("winner approval unknown id", "/api/admin/competitions/00000000-0000-4000-8000-000000000000/winner-approval", {
  cookie: admin, method: "POST", body: { action: "approve" },
});

console.log("\n===== INVESTOR PAGES =====");
await page("/onboarding/investor", "/onboarding/investor", investor);
await page("/dashboard", "/dashboard", investor);
await page("/discover", "/discover", investor);
await page("/competitions/host", "/competitions/host", investor);
await page("/competitions/manage", "/competitions/manage", investor);
await page("/settings", "/settings", investor);
await page("/messages", "/messages", investor);
await page("/investors", "/investors", investor);

console.log("\n===== INVESTOR PROFILE WRITE =====");
const before = await call("read overview", "/api/connections", { cookie: investor });
await call("update investor profile", "/api/investors", {
  cookie: investor,
  method: "POST",
  body: {
    fullName: "Michael Torres",
    investorType: "vc",
    firmName: "Horizon Ventures",
    location: "San Francisco, CA",
    checkSizeMin: 250000,
    checkSizeMax: 2000000,
    stageFocus: ["seed", "series-a"],
    sectorFocus: ["climate", "ai/ml"],
    sdgPreferences: [7, 13],
    investmentThesis: "QA updated thesis: climate and AI infrastructure.",
    linkedin: "https://linkedin.com/in/michaeltorres",
  },
});
await call("investor profile validation (bad shift type)", "/api/investors", {
  cookie: investor,
  method: "POST",
  body: { fullName: "" },
});
await call("create competition with missing fields", "/api/competitions", {
  cookie: investor,
  method: "POST",
  body: {},
});
console.log("\nconnections overview counts:", JSON.stringify(before.body?.counts));
