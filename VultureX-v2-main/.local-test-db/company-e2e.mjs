import { testPassword, adminCreds } from "./config.mjs";
import fs from "node:fs";
import postgres from "postgres";

const base = "http://127.0.0.1:3000";
const stamp = Date.now().toString(36);
const S1 = `qa.e2e.s1.${stamp}@vulturex.test`;
const S2 = `qa.e2e.s2.${stamp}@vulturex.test`;
const INV = `qa.e2e.inv.${stamp}@vulturex.test`;
const PASS = testPassword();

const dbUrl = (fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m) || [])[1].trim();
const db = postgres(dbUrl, { max: 1, prepare: false, connect_timeout: 20 });

function jar() {
  return { cookies: new Map() };
}
function store(j, res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    if (i > 0) j.cookies.set(pair.slice(0, i), pair.slice(i + 1));
  }
}
function cookie(j) {
  return [...j.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
}
async function req(j, path, { method = "GET", body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", cookie: cookie(j) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  store(j, res);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text.slice(0, 120); }
  return { status: res.status, body: json };
}
async function login(email, role) {
  const j = jar();
  const csrf = await req(j, "/api/auth/csrf");
  const token = csrf.body?.csrfToken;
  if (!token) throw new Error("no csrf: " + JSON.stringify(csrf.body));
  const res = await fetch(base + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookie(j) },
    body: new URLSearchParams({
      csrfToken: token, email, password: PASS, role, redirect: "false",
      callbackUrl: base + "/dashboard",
    }),
    redirect: "manual",
  });
  store(j, res);
  return { j, status: res.status, hasSession: cookie(j).includes("authjs.session-token") };
}
const log = (label, r) => console.log(`\n[${r.status}] ${label}\n${JSON.stringify(r.body).slice(0, 400)}`);

// Wait for server + company DB.
for (let i = 0; i < 40; i++) {
  const r = await fetch(base + "/api/auth/csrf").catch(() => null);
  if (r && r.status === 200) break;
  await new Promise((res) => setTimeout(res, 2000));
}
console.log("baseline:", JSON.stringify((await db`select (select count(*) from users)::int users,(select count(*) from startups)::int startups,(select count(*) from investors)::int investors`)[0]));

console.log("\n=== SIGNUP + LOGIN (company DB) ===");
for (const [email, role] of [[S1, "startup"], [S2, "startup"], [INV, "investor"]]) {
  log(`signup ${role}`, await req(jar(), "/api/auth/signup", { method: "POST", body: { email, password: PASS, name: `QA E2E ${role}`, role } }));
}
const a = await login(S1, "startup");
const b = await login(S2, "startup");
const inv = await login(INV, "investor");
console.log("sessions:", { s1: a.hasSession, s2: b.hasSession, inv: inv.hasSession });

const mk = (name, offers, needs, extra = {}) => ({
  name, tagline: `${name} — QA E2E record`, sector: "climate", stage: "seed",
  location: "QA Test", website: "https://example.test",
  problem: "QA test problem statement.", solution: "QA test solution statement.",
  mrr: 5000, monthlyGrowth: 10, activeUsers: 50, customers: 10,
  fundingRaised: 100000, burnRate: 20000, runwayMonths: 12,
  founderName: "QA Founder", founderRole: "CEO", founderBio: "QA bio for end-to-end testing.",
  founderLinkedin: "https://linkedin.com/in/qa-e2e", teamSize: 3,
  offerings: offers, needs, targetCustomers: ["qa customers"],
  ...extra,
});

console.log("\n=== STARTUP PROFILES ===");
const p1 = await req(a.j, "/api/startups", { method: "POST", body: mk(`QA E2E Alpha ${stamp}`, ["sustainable packaging", "compostable labels"], ["last-mile logistics"], { sdgGoals: [13, 12], sdgPrimary: 13, impactDescription: "QA impact claim: compostable packaging reduces single-use plastic waste in supply chains by a measurable margin." }) });
log("startup1 profile", p1);
const p2 = await req(b.j, "/api/startups", { method: "POST", body: mk(`QA E2E Beta ${stamp}`, ["last-mile logistics", "warehousing"], ["sustainable packaging"]) });
log("startup2 profile", p2);
const invProfile = await req(inv.j, "/api/investors", { method: "POST", body: { fullName: "QA E2E Investor", investorType: "vc", firmName: "QA E2E Capital", location: "QA Test", checkSizeMin: 100000, checkSizeMax: 1000000, stageFocus: ["seed"], sectorFocus: ["climate"], sdgPreferences: [13], investmentThesis: "QA thesis.", linkedin: "https://linkedin.com/in/qa-e2e" } });
log("investor profile", invProfile);

console.log("\n=== RECOMMENDATIONS ===");
const recalc = await req(a.j, "/api/startups", { method: "POST", body: mk(`QA E2E Alpha ${stamp}`, ["sustainable packaging", "compostable labels"], ["last-mile logistics"], { sdgGoals: [13, 12], sdgPrimary: 13, impactDescription: "QA impact claim: compostable packaging reduces single-use plastic waste in supply chains by a measurable margin." }) });
console.log("profile re-save for recalc:", recalc.status);
const recs = await req(a.j, "/api/recommendations");
log("recommendations for startup1", recs);
const recs2 = await req(b.j, "/api/recommendations");
log("recommendations for startup2", recs2);

console.log("\n=== INTEREST+ -> CONNECTION -> MESSAGING ===");
const s2row = (await db`select id, user_id from startups where name = ${`QA E2E Beta ${stamp}`}`)[0];
const send = await req(a.j, "/api/connections", { method: "POST", body: { userId: s2row.user_id, message: "QA E2E connection request" } });
log("send Interest+", send);
const inbox = await req(b.j, "/api/connections");
const incoming = inbox.body?.incoming?.[0];
log("startup2 inbox", { status: inbox.status, body: inbox.body?.counts });
let conversationId = null;
if (incoming) {
  log("accept", await req(b.j, `/api/connections/${incoming.id}`, { method: "PATCH", body: { action: "accept" } }));
  const conv = await req(b.j, "/api/messages");
  conversationId = conv.body?.conversations?.[0]?.id;
  log("conversation", { status: conv.status, body: conversationId });
  if (conversationId) {
    log("message", await req(b.j, `/api/messages/${conversationId}`, { method: "POST", body: { body: "QA E2E hello" } }));
    log("thread as startup1", await req(a.j, `/api/messages/${conversationId}`));
  }
}

console.log("\n=== PITCH DECK WORKFLOW ===");
const deck = await req(a.j, "/api/pitch-deck/requests", { method: "POST", body: { kind: "new" } });
log("create request", deck);
const deckId = deck.body?.request?.id;
if (deckId) {
  log("batch1", await req(a.j, `/api/pitch-deck/requests/${deckId}`, { method: "PATCH", body: { action: "save_batch", batch: 1, answers: { Q1A: "SaaS / Subscription", Q1B: "B2B", NEW_DESC: "QA E2E startup description for the pitch deck questionnaire.", Q2: { value: "500", currency: "$", unit: "Million" }, Q3: { value: "100", currency: "$", unit: "Million" }, Q4: { value: "10", currency: "$", unit: "Million" }, Q5: "QA E2E basis from industry reports.", Q6: "QA E2E mid-market logistics teams.", Q7: "Live" } } }));
  log("batch2", await req(a.j, `/api/pitch-deck/requests/${deckId}`, { method: "PATCH", body: { action: "save_batch", batch: 2, answers: { Q8: [{ name: "Manual spreadsheets", difference: "QA E2E automation" }], Q9: ["Data advantage"], Q10: ["Direct sales"] } } }));
  log("batch3", await req(a.j, `/api/pitch-deck/requests/${deckId}`, { method: "PATCH", body: { action: "save_batch", batch: 3, answers: { Q11: "not_raising" } } }));
  const submitted = await req(a.j, `/api/pitch-deck/requests/${deckId}`, { method: "PATCH", body: { action: "submit" } });
  log("submit", submitted);
  const summary = submitted.body?.request?.summary;
  log("approve summary", await req(a.j, `/api/pitch-deck/requests/${deckId}`, { method: "PATCH", body: { action: "approve", summary } }));
  const adminPage = await fetch(base + "/admin/pitch-decks", { headers: { cookie: "" } });
  console.log("admin page without session:", adminPage.status);
}

console.log("\n=== SDG / IMPACT ===");
const claim = await req(a.j, "/api/impact", { method: "POST", body: { action: "submit" } });
log("submit claim", claim);
const claimId = claim.body?.claim?.id;
if (claimId) {
  const admin = await login(adminCreds().email, adminCreds().password);
  console.log("admin session:", admin.hasSession);
  log("admin verify claim", await req(admin.j, `/api/admin/impact/${claimId}`, { method: "POST", body: { action: "verified" } }));
  const profile = await fetch(base + "/explore/" + p1.body.slug, { headers: { cookie: cookie(a.j) } });
  const html = await profile.text();
  console.log("profile page:", profile.status, "| verified wording present:", /verified/i.test(html));
}

console.log("\n=== COMPETITION DRAFT + ADMIN REVIEW ===");
const comp = await req(inv.j, "/api/competitions", { method: "POST", body: { title: `QA E2E Draft ${stamp}`, summary: "QA E2E draft competition.", description: "QA E2E draft competition description.", category: "climate", eligibility: "QA E2E startups", prize: "QA recognition" } });
log("create draft", comp);
const compId = comp.body?.id;
if (compId) {
  const admin = await login(adminCreds().email, adminCreds().password);
  log("admin approve draft", await req(admin.j, `/api/admin/competitions/${compId}`, { method: "PATCH", body: { action: "approve" } }));
  console.log("publish deliberately NOT executed (publication prohibited by test safety rules)");
}

console.log("\n=== NOTIFICATIONS + FOUNDER PROFILE + REMINDER ===");
log("notifications startup1", await req(a.j, "/api/notifications"));
log("founder profile save", await req(a.j, "/api/founder-profile", { method: "PUT", body: { preferredLanguage: "en", location: "QA Test", challenges: ["funding"], guidanceAreas: ["finance"], profileVisibility: true, collaborationVisibility: "network", onboardingComplete: true } }));
log("reminder create", await req(a.j, "/api/reminders", { method: "POST", body: { title: "QA E2E reminder", dueDate: "2027-01-15" } }));

console.log("\n=== DATABASE EVIDENCE ===");
const evidence = await db`
  select
    (select count(*) from startups where name like ${"QA E2E %"})::int qa_startups,
    (select count(*) from investors where full_name = 'QA E2E Investor')::int qa_investors,
    (select count(*) from startup_recommendations)::int recommendation_rows,
    (select count(*) from connection_requests)::int connection_requests,
    (select count(*) from conversations)::int conversations,
    (select count(*) from messages)::int messages,
    (select count(*) from pitch_deck_requests)::int deck_requests,
    (select count(*) from startup_impact_claims)::int impact_claims,
    (select count(*) from competitions where title like ${"QA E2E %"})::int qa_competitions,
    (select count(*) from founder_profiles)::int founder_profiles,
    (select count(*) from reminders)::int reminders,
    (select count(*) from notifications)::int notifications
`;
console.log(JSON.stringify(evidence[0]));

console.log("\n=== CLEANUP (this run only) ===");
try {
  if (compId) await db`delete from competitions where id = ${compId}`;
  await db`delete from notifications where recipient_user_id in (select id from users where email like ${"qa.e2e.%"})`;
  const deleted = await db`delete from users where email like ${"qa.e2e.%"}`;
  console.log("deleted users:", deleted.count);
} catch (error) {
  console.log("cleanup error:", error.message);
}
const after = await db`select (select count(*) from users)::int users,(select count(*) from startups)::int startups,(select count(*) from investors)::int investors,(select count(*) from competitions)::int competitions,(select count(*) from pitch_deck_requests)::int decks,(select count(*) from startup_impact_claims)::int claims,(select count(*) from startup_recommendations)::int recs,(select count(*) from conversations)::int convs,(select count(*) from messages)::int msgs,(select count(*) from notifications)::int notifications`;
console.log("after cleanup:", JSON.stringify(after[0]));
await db.end({ timeout: 2 });
