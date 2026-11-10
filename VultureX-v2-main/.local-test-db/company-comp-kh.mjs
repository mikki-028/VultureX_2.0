import fs from "node:fs";
import postgres from "postgres";

const base = "http://127.0.0.1:3000";
const stamp = Date.now().toString(36);
const EMAIL = (r) => `qa.e2e.${r}.${stamp}@vulturex.test`;
const INV = EMAIL("inv"), A = EMAIL("a"), B = EMAIL("b"), PASS = "qa-e2e-pass-123";
const dbUrl = (fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m) || [])[1].trim();
const db = postgres(dbUrl, { max: 1, prepare: false });

function jar() { return { cookies: new Map() }; }
function store(j, r) {
  for (const raw of r.headers.getSetCookie?.() ?? []) {
    const [p] = raw.split(";");
    const i = p.indexOf("=");
    if (i > 0) j.cookies.set(p.slice(0, i), p.slice(i + 1));
  }
}
const ck = (j) => [...j.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
async function req(j, p, { method = "GET", body } = {}) {
  const r = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", cookie: ck(j) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  store(j, r);
  const t = await r.text();
  let b; try { b = JSON.parse(t); } catch { b = t.slice(0, 80); }
  return { status: r.status, body: b };
}
async function login(email, password, role) {
  const j = jar();
  const c = await req(j, "/api/auth/csrf");
  const r = await fetch(base + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: ck(j) },
    body: new URLSearchParams({ csrfToken: c.body.csrfToken, email, password, role, redirect: "false", callbackUrl: base + "/" }),
    redirect: "manual",
  });
  store(j, r);
  return { j, ok: ck(j).includes("authjs.session-token") };
}
const log = (l, r) => console.log(`[${r.status}] ${l}: ${JSON.stringify(r.body).slice(0, 150)}`);

for (const [e, r] of [[INV, "investor"], [A, "startup"], [B, "startup"]]) {
  await req(jar(), "/api/auth/signup", { method: "POST", body: { email: e, password: PASS, name: `QA ${r}`, role: r } });
}
const inv = await login(INV, PASS, "investor");
const a = await login(A, PASS, "startup");
const b = await login(B, PASS, "startup");
const admin = await login("asmita.gupta008@gmail.com", "vulturex", "admin");
console.log("sessions:", { inv: inv.ok, a: a.ok, b: b.ok, admin: admin.ok });

log("investor onboarding", await req(inv.j, "/api/investors", { method: "POST", body: { fullName: "QA Comp Investor", investorType: "vc", firmName: "QA Comp VC", stageFocus: ["seed"], sectorFocus: ["climate"] } }));

const comp = {
  title: `QA E2E Full Comp ${stamp}`,
  summary: "QA E2E full competition summary.",
  description: "QA E2E full competition description with enough detail for review.",
  category: "climate",
  openAt: "2026-12-01T00:00:00.000Z",
  deadline: "2027-01-15T00:00:00.000Z",
  evaluationEndsAt: "2027-02-01T00:00:00.000Z",
  criteria: [{ key: "impact", label: "Impact", weight: 60 }, { key: "team", label: "Team", weight: 40 }],
  prizeAmount: 5000,
  prizeCurrency: "USD",
  eligibility: { allStages: true },
};
const d1 = await req(inv.j, "/api/competitions", { method: "POST", body: comp });
log("draft", d1);
if (d1.body?.id) {
  log("submit for review", await req(inv.j, `/api/competitions/${d1.body.id}`, { method: "PATCH", body: { ...comp, submit: true } }));
  console.log("state:", JSON.stringify((await db`select status, submitted_at is not null submitted from competitions where id=${d1.body.id}`)[0]));
  const page = await fetch(base + "/admin/competitions", { headers: { cookie: ck(admin.j) } });
  const html = await page.text();
  console.log("admin competitions page:", page.status, "| proposal listed:", html.includes(comp.title));
  log("admin approves", await req(admin.j, `/api/admin/competitions/${d1.body.id}`, { method: "PATCH", body: { action: "approve" } }));
  console.log("after approve:", JSON.stringify((await db`select status from competitions where id=${d1.body.id}`)[0]));
  log("submit again after approval", await req(inv.j, `/api/competitions/${d1.body.id}`, { method: "PATCH", body: { ...comp, submit: true } }));
  console.log("review notification:", JSON.stringify(await db`select type from notifications where body ilike ${"%QA E2E Full Comp%"} limit 3`));
}
const d2 = await req(inv.j, "/api/competitions", { method: "POST", body: { ...comp, title: `QA E2E Reject Comp ${stamp}` } });
if (d2.body?.id) {
  await req(inv.j, `/api/competitions/${d2.body.id}`, { method: "PATCH", body: { ...comp, title: `QA E2E Reject Comp ${stamp}`, submit: true } });
  log("admin rejects", await req(admin.j, `/api/admin/competitions/${d2.body.id}`, { method: "PATCH", body: { action: "reject", note: "QA E2E rejection" } }));
  console.log("reject state:", JSON.stringify((await db`select status, rejection_reason from competitions where id=${d2.body.id}`)[0]));
}

console.log("\n=== KH PROFILE / SAVED / BOOKMARK / REMINDER ===");
const mk = (name) => ({
  name, tagline: "QA E2E KH record", sector: "saas", stage: "seed", location: "QA Test",
  problem: "QA problem.", solution: "QA solution.", mrr: 1000, monthlyGrowth: 5, activeUsers: 10,
  customers: 2, offerings: ["qa-e2e-only-offering"], needs: ["qa-e2e-only-need"],
  targetCustomers: ["QA"], founderName: "QA Founder", teamSize: 2,
});
const pa = await req(a.j, "/api/startups", { method: "POST", body: mk(`QA E2E KH Alpha ${stamp}`) });
log("startup A profile", pa);
const pb = await req(b.j, "/api/startups", { method: "POST", body: mk(`QA E2E KH Beta ${stamp}`) });
log("startup B profile", pb);

log("founder profile save", await req(a.j, "/api/founder-profile", { method: "PUT", body: { preferredLanguage: "hi", location: "QA Test", challenges: ["funding"], guidanceAreas: ["finance"], priorities: ["growth"], learningInterests: ["fundraising"], profileVisibility: true, collaborationVisibility: "network", onboardingComplete: true } }));
const fp = await req(a.j, "/api/founder-profile");
console.log("founder profile reload:", fp.status, "| language:", fp.body?.profile?.preferredLanguage);

log("save resource", await req(a.j, "/api/saved-resources", { method: "POST", body: { key: "/knowledge-hub/funding" } }));
log("save resource duplicate", await req(a.j, "/api/saved-resources", { method: "POST", body: { key: "/knowledge-hub/funding" } }));
const sr = await req(a.j, "/api/saved-resources");
const srB = await req(b.j, "/api/saved-resources");
console.log("saved resources:", sr.status, "| A count:", sr.body?.resources?.length, "| B count:", srB.body?.resources?.length);

if (pb.body?.id) {
  log("bookmark", await req(a.j, "/api/bookmarks", { method: "POST", body: { startupId: pb.body.id } }));
  log("bookmark duplicate", await req(a.j, "/api/bookmarks", { method: "POST", body: { startupId: pb.body.id } }));
  const bmA = await req(a.j, "/api/bookmarks");
  const bmB = await req(b.j, "/api/bookmarks");
  console.log("bookmarks:", bmA.status, "| A count:", bmA.body?.bookmarks?.length, "| B count:", bmB.body?.bookmarks?.length);
}
log("reminder", await req(a.j, "/api/reminders", { method: "POST", body: { title: "QA E2E KH reminder", dueDate: "2027-02-20" } }));
const remA = await req(a.j, "/api/reminders");
const remB = await req(b.j, "/api/reminders");
console.log("reminders:", remA.status, "| A count:", remA.body?.reminders?.length, "| B count:", remB.body?.reminders?.length);

console.log("\nKH pages:");
for (const p of ["/knowledge-hub", "/knowledge-hub/start-business", "/knowledge-hub/funding", "/knowledge-hub/marketing-sales", "/knowledge-hub/scam-watch", "/knowledge-hub/tools-templates", "/knowledge-hub/for-you", "/knowledge-hub/for-you/profile", "/knowledge-hub/for-you/saved", "/knowledge-hub/for-you/reminders", "/knowledge-hub/roadmap"]) {
  const r = await fetch(base + p, { headers: { cookie: ck(a.j) }, redirect: "manual" });
  console.log(` ${r.status} ${p}${r.status >= 300 && r.status < 400 ? " -> " + r.headers.get("location") : ""}`);
}
const anon = await fetch(base + "/knowledge-hub/for-you", { redirect: "manual" });
console.log("anon for-you:", anon.status, "->", anon.headers.get("location"));

console.log("\n=== CLEANUP ===");
try {
  await db`delete from competitions where title like ${"QA E2E %"}`;
  await db`delete from notifications where body ilike ${"%QA E2E%"}`;
  const del = await db`delete from users where email like ${"qa.e2e.%"}`;
  console.log("deleted users:", del.count);
} catch (e) { console.log("cleanup error:", e.message); }
console.log("after:", JSON.stringify((await db`select (select count(*) from users)::int users,(select count(*) from startups)::int startups,(select count(*) from investors)::int investors,(select count(*) from competitions)::int comps,(select count(*) from notifications)::int notifications,(select count(*) from bookmarks)::int bookmarks,(select count(*) from saved_resources)::int saved,(select count(*) from reminders)::int reminders,(select count(*) from founder_profiles)::int profiles`)[0]));
await db.end({ timeout: 2 });
