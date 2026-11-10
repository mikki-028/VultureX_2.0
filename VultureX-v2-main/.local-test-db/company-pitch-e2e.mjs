import fs from "node:fs";
import postgres from "postgres";

const base = "http://127.0.0.1:3000";
const stamp = Date.now().toString(36);
const S = `qa.e2e.deck.${stamp}@vulturex.test`;
const I = `qa.e2e.deckinv.${stamp}@vulturex.test`;
const O = `qa.e2e.deckother.${stamp}@vulturex.test`;
const PASS = "qa-e2e-pass-123";
const dbUrl = (fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m) || [])[1].trim();
const db = postgres(dbUrl, { max: 1, prepare: false });

function jar() { return { cookies: new Map() }; }
function store(j, r) {
  for (const raw of r.headers.getSetCookie?.() ?? []) {
    const [p] = raw.split(";"); const i = p.indexOf("=");
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
  let b; try { b = JSON.parse(t); } catch { b = t.slice(0, 120); }
  return { status: r.status, body: b, headers: r.headers };
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
const log = (l, r) => console.log(`[${r.status}] ${l}: ${JSON.stringify(r.body).slice(0, 140)}`);

for (const [e, r] of [[S, "startup"], [I, "investor"], [O, "startup"]]) {
  await req(jar(), "/api/auth/signup", { method: "POST", body: { email: e, password: PASS, name: `QA ${r}`, role: r } });
}
const s = await login(S, PASS, "startup");
const i = await login(I, PASS, "investor");
const o = await login(O, PASS, "startup");
const admin = await login("asmita.gupta008@gmail.com", "vulturex", "admin");
console.log("sessions:", { startup: s.ok, investor: i.ok, other: o.ok, admin: admin.ok });

const mk = (name) => ({
  name, tagline: "QA deck test", sector: "saas", stage: "seed", location: "QA",
  problem: "QA problem.", solution: "QA solution.", mrr: 1000, monthlyGrowth: 5,
  activeUsers: 10, customers: 2, teamSize: 2, founderName: "QA Founder",
  offerings: [`qa-only-offer-${stamp}`], needs: [`qa-only-need-${stamp}`],
  targetCustomers: ["qa-only"],
});
const ps = await req(s.j, "/api/startups", { method: "POST", body: mk(`QA E2E Deck ${stamp}`) });
const po = await req(o.j, "/api/startups", { method: "POST", body: mk(`QA E2E Other ${stamp}`) });
const pi = await req(i.j, "/api/investors", { method: "POST", body: { fullName: "QA Deck Investor", investorType: "vc", firmName: "QA Deck VC", stageFocus: ["seed"], sectorFocus: ["saas"] } });
console.log("startup/investor profiles:", ps.status, po.status, pi.status);
const slug = ps.body?.slug;
console.log("startup slug:", slug);

const deck = await req(s.j, "/api/pitch-deck/requests", { method: "POST", body: { kind: "new" } });
const id = deck.body?.request?.id;
log("create request", deck);
await req(s.j, `/api/pitch-deck/requests/${id}`, { method: "PATCH", body: { action: "save_batch", batch: 1, answers: { Q1A: "SaaS / Subscription", Q1B: "B2B", NEW_DESC: "QA E2E deck description.", Q2: { value: "500", currency: "$", unit: "Million" }, Q3: { value: "100", currency: "$", unit: "Million" }, Q4: { value: "10", currency: "$", unit: "Million" }, Q5: "QA basis.", Q6: "QA customer.", Q7: "Live" } } });
await req(s.j, `/api/pitch-deck/requests/${id}`, { method: "PATCH", body: { action: "save_batch", batch: 2, answers: { Q8: [{ name: "Manual", difference: "QA" }], Q9: ["Data advantage"], Q10: ["Direct sales"] } } });
await req(s.j, `/api/pitch-deck/requests/${id}`, { method: "PATCH", body: { action: "save_batch", batch: 3, answers: { Q11: "not_raising" } } });
const submitted = await req(s.j, `/api/pitch-deck/requests/${id}`, { method: "PATCH", body: { action: "submit" } });
const approved = await req(s.j, `/api/pitch-deck/requests/${id}`, { method: "PATCH", body: { action: "approve", summary: submitted.body?.request?.summary } });
console.log("submit/approve:", submitted.status, approved.status);
const adminNotifications = await req(admin.j, "/api/notifications");
console.log("admin notified of submit:", adminNotifications.body?.notifications?.some((n) => n.type === "pitch_deck_submitted" && String(n.body).includes(stamp)));

// Admin uploads a real (tiny) PDF while keeping the request private.
const form = new FormData();
form.append("file", new Blob([Buffer.from("%PDF-1.4\n% QA E2E deck\n%%EOF\n")], { type: "application/pdf" }), "qa-deck.pdf");
const uploadRes = await fetch(base + `/api/admin/pitch-deck/requests/${id}/upload`, {
  method: "POST", headers: { cookie: ck(admin.j) }, body: form, redirect: "manual",
});
const upload = { status: uploadRes.status, body: await uploadRes.json() };
log("admin upload", upload);
const fileId = upload.body?.file?.id;

const before = async (label, j) => {
  const r = await fetch(base + `/api/files/${fileId}`, { headers: { cookie: ck(j) }, redirect: "manual" });
  console.log(`file before publish — ${label}:`, r.status);
  return r;
};
await before("owner", s.j);
await before("investor", i.j);
const adminFile = await fetch(base + `/api/files/${fileId}`, { headers: { cookie: ck(admin.j) }, redirect: "manual" });
console.log("file before publish — admin:", adminFile.status);

const publish = await req(admin.j, `/api/admin/pitch-deck/requests/${id}/publish`, { method: "POST", body: { fileId } });
log("publish", publish);
console.log("request status:", JSON.stringify((await db`select status, published_at is not null published from pitch_deck_requests where id=${id}`)[0]));

const after = async (label, j) => {
  const r = await fetch(base + `/api/files/${fileId}`, { headers: { cookie: ck(j) }, redirect: "manual" });
  const bytes = Buffer.from(await r.arrayBuffer());
  console.log(`file after publish — ${label}:`, r.status, r.headers.get("content-type"), bytes.length, bytes.toString("utf8").includes("QA E2E deck"));
};
await after("owner", s.j);
await after("investor", i.j);
const otherFile = await fetch(base + `/api/files/${fileId}`, { headers: { cookie: ck(o.j) }, redirect: "manual" });
console.log("file after publish — other startup:", otherFile.status);
const anonFile = await fetch(base + `/api/files/${fileId}`, { redirect: "manual" });
console.log("file after publish — anonymous:", anonFile.status);

const startupNotifications = await req(s.j, "/api/notifications");
console.log("startup published notification:", startupNotifications.body?.notifications?.some((n) => n.type === "pitch_deck_published" && String(n.body).includes(stamp)));
if (slug) {
  const profile = await fetch(base + `/explore/${slug}`, { headers: { cookie: ck(i.j) }, redirect: "manual" });
  const html = await profile.text();
  console.log("investor profile page:", profile.status, "| deck visible:", html.includes("qa-deck.pdf"), "| view link:", html.includes(`/api/files/${fileId}`));
  const anonProfile = await fetch(base + `/explore/${slug}`, { redirect: "manual" });
  const anonHtml = await anonProfile.text();
  console.log("anonymous profile deck link present:", anonHtml.includes(`/api/files/${fileId}`));
}

console.log("\n=== CLEANUP ===");
try {
  await db`delete from pitch_deck_requests where id=${id}`;
  await db`delete from notifications where body ilike ${"%QA E2E%"}`;
  const del = await db`delete from users where email like ${"qa.e2e.%"}`;
  console.log("deleted users:", del.count);
} catch (error) { console.log("cleanup error:", error.message); }
console.log("baseline:", JSON.stringify((await db`select (select count(*) from users)::int users,(select count(*) from startups)::int startups,(select count(*) from investors)::int investors,(select count(*) from pitch_deck_requests)::int decks,(select count(*) from pitch_deck_files)::int files,(select count(*) from notifications)::int notifications`)[0]));
await db.end({ timeout: 2 });
