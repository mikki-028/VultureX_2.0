import { testPassword, adminCreds } from "./config.mjs";
import fs from "node:fs";
import postgres from "postgres";

const base = "http://127.0.0.1:3000";
const stamp = Date.now().toString(36);
const S1 = `qa.e2e.admincheck.${stamp}@vulturex.test`;
const INV = `qa.e2e.admininv.${stamp}@vulturex.test`;
const PASS = testPassword();
const ADMIN = adminCreds();

const dbUrl = (fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m) || [])[1].trim();
const db = postgres(dbUrl, { max: 1, prepare: false, connect_timeout: 20 });

function jar() { return { cookies: new Map() }; }
function store(j, res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    if (i > 0) j.cookies.set(pair.slice(0, i), pair.slice(i + 1));
  }
}
const cookie = (j) => [...j.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
async function req(j, path, { method = "GET", body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", cookie: cookie(j) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  store(j, res);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 120); }
  return { status: res.status, body: json };
}
async function login(email, password, role) {
  const j = jar();
  const csrf = await req(j, "/api/auth/csrf");
  const token = csrf.body?.csrfToken;
  if (!token) throw new Error("no csrf");
  const res = await fetch(base + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookie(j) },
    body: new URLSearchParams({ csrfToken: token, email, password, role, redirect: "false", callbackUrl: base + "/admin" }),
    redirect: "manual",
  });
  store(j, res);
  return { j, ok: cookie(j).includes("authjs.session-token") };
}
const log = (label, r) => console.log(`\n[${r.status}] ${label}\n${JSON.stringify(r.body).slice(0, 320)}`);

console.log("leftover notifications before run:");
console.log(JSON.stringify(await db`select n.id, u.email, n.type, n.body from notifications n left join users u on u.id = n.recipient_user_id`));

const admin = await login(ADMIN.email, ADMIN.password, "admin");
console.log("\nadmin session:", admin.ok);

for (const [email, role] of [[S1, "startup"], [INV, "investor"]]) {
  log(`signup ${role}`, await req(jar(), "/api/auth/signup", { method: "POST", body: { email, password: PASS, name: `QA E2E ${role}`, role } }));
}
const s = await login(S1, PASS, "startup");
const inv = await login(INV, PASS, "investor");
console.log("sessions:", { startup: s.ok, investor: inv.ok });

const profile = await req(s.j, "/api/startups", { method: "POST", body: {
  name: `QA E2E AdminCheck ${stamp}`, tagline: "QA E2E record", sector: "climate", stage: "seed",
  location: "QA Test", website: "https://example.test", problem: "QA problem.", solution: "QA solution.",
  mrr: 1000, monthlyGrowth: 5, activeUsers: 10, customers: 2, fundingRaised: 0, burnRate: 0,
  runwayMonths: 6, founderName: "QA Founder", teamSize: 2,
  offerings: ["sustainable packaging"], needs: ["logistics"], targetCustomers: ["QA buyers"],
  sdgGoals: [13, 12], sdgPrimary: 13,
  impactDescription: "QA impact claim text long enough to satisfy the verification threshold for testing.",
} });
log("startup profile", profile);

log("submit impact claim", await req(s.j, "/api/impact", { method: "POST", body: { action: "submit" } }));
const claim = (await db`select c.id, c.status from startup_impact_claims c join startups st on st.id=c.startup_id where st.name = ${`QA E2E AdminCheck ${stamp}`}`)[0];
console.log("claim row:", JSON.stringify(claim));
if (claim) {
  log("admin verifies claim", await req(admin.j, `/api/admin/impact/${claim.id}`, { method: "POST", body: { action: "verified" } }));
  const after = (await db`select status, review_note, reviewed_by_user_id from startup_impact_claims where id=${claim.id}`)[0];
  console.log("claim after verify:", JSON.stringify(after));
}

const comp = await req(inv.j, "/api/competitions", { method: "POST", body: {
  title: `QA E2E AdminCheck Draft ${stamp}`, summary: "QA E2E draft.", description: "QA E2E draft description.",
  category: "climate", eligibility: "QA E2E startups", prize: "QA recognition",
} });
log("competition draft", comp);
const compId = comp.body?.id;
if (compId) {
  log("admin approves draft", await req(admin.j, `/api/admin/competitions/${compId}`, { method: "PATCH", body: { action: "approve" } }));
  console.log("competition after approve:", JSON.stringify((await db`select status from competitions where id=${compId}`)[0]));
  console.log("publish not executed (safety rules)");
}

console.log("\n=== PITCH DECK: submit -> approve -> admin status ===");
const deck = await req(s.j, "/api/pitch-deck/requests", { method: "POST", body: { kind: "new" } });
const deckId = deck.body?.request?.id;
log("create deck request", deck);
if (deckId) {
  await req(s.j, `/api/pitch-deck/requests/${deckId}`, { method: "PATCH", body: { action: "save_batch", batch: 1, answers: { Q1A: "SaaS / Subscription", Q1B: "B2B", NEW_DESC: "QA E2E description.", Q2: { value: "500", currency: "$", unit: "Million" }, Q3: { value: "100", currency: "$", unit: "Million" }, Q4: { value: "10", currency: "$", unit: "Million" }, Q5: "QA basis.", Q6: "QA customer.", Q7: "Live" } } });
  await req(s.j, `/api/pitch-deck/requests/${deckId}`, { method: "PATCH", body: { action: "save_batch", batch: 2, answers: { Q8: [{ name: "Manual", difference: "QA" }], Q9: ["Data advantage"], Q10: ["Direct sales"] } } });
  await req(s.j, `/api/pitch-deck/requests/${deckId}`, { method: "PATCH", body: { action: "save_batch", batch: 3, answers: { Q11: "not_raising" } } });
  const submitted = await req(s.j, `/api/pitch-deck/requests/${deckId}`, { method: "PATCH", body: { action: "submit" } });
  log("submit", submitted);
  const summary = submitted.body?.request?.summary;
  log("approve summary", await req(s.j, `/api/pitch-deck/requests/${deckId}`, { method: "PATCH", body: { action: "approve", summary } }));

  const queue = await fetch(base + "/admin/pitch-decks", { headers: { cookie: cookie(admin.j) } });
  const html = await queue.text();
  console.log("admin queue:", queue.status, "| request title listed:", html.includes(`QA E2E AdminCheck ${stamp} Pitch Deck`));

  log("admin sets in_progress", await req(admin.j, `/api/admin/pitch-deck/requests/${deckId}/status`, { method: "POST", body: { status: "in_progress", note: "QA E2E admin note" } }));
  console.log("deck after admin status:", JSON.stringify((await db`select status, admin_note from pitch_deck_requests where id=${deckId}`)[0]));
}

console.log("\n=== NOTIFICATIONS CREATED ===");
console.log(JSON.stringify(await db`select u.email, n.type, n.body from notifications n left join users u on u.id=n.recipient_user_id order by n.created_at`));

console.log("\n=== CLEANUP (this run only) ===");
try {
  if (compId) await db`delete from competitions where id=${compId}`;
  await db`delete from notifications where body ilike ${"%QA E2E%"}`;
  const del = await db`delete from users where email like ${"qa.e2e.%"}`;
  console.log("deleted users:", del.count);
} catch (e) { console.log("cleanup error:", e.message); }
console.log("after:", JSON.stringify((await db`select (select count(*) from users)::int users,(select count(*) from startups)::int startups,(select count(*) from investors)::int investors,(select count(*) from competitions)::int comps,(select count(*) from pitch_deck_requests)::int decks,(select count(*) from startup_impact_claims)::int claims,(select count(*) from startup_recommendations)::int recs,(select count(*) from conversations)::int convs,(select count(*) from messages)::int msgs,(select count(*) from notifications)::int notifications,(select count(*) from founder_profiles)::int profiles,(select count(*) from reminders)::int reminders`)[0]));
await db.end({ timeout: 2 });
