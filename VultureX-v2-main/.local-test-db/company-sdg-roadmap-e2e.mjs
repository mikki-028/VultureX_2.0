import { testPassword, adminCreds } from "./config.mjs";
import fs from "node:fs";
import postgres from "postgres";

const base = "http://127.0.0.1:3000";
const stamp = Date.now().toString(36);
const A = `qa.e2e.sdg.${stamp}@vulturex.test`;
const B = `qa.e2e.sdgb.${stamp}@vulturex.test`;
const PASS = testPassword();
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

for (const [e, r] of [[A, "startup"], [B, "startup"]]) {
  await req(jar(), "/api/auth/signup", { method: "POST", body: { email: e, password: PASS, name: `QA ${r}`, role: r } });
}
const a = await login(A, PASS, "startup");
const b = await login(B, PASS, "startup");
const admin = await login(adminCreds().email, adminCreds().password, "admin");
console.log("sessions:", { a: a.ok, b: b.ok, admin: admin.ok });

const mk = (name) => ({
  name, tagline: "QA SDG record", sector: "climate", stage: "seed", location: "QA",
  problem: "QA problem.", solution: "QA solution.", mrr: 1000, monthlyGrowth: 5,
  activeUsers: 10, customers: 2, teamSize: 2, founderName: "QA Founder",
  offerings: [`qa-sdg-offer-${stamp}`], needs: [`qa-sdg-need-${stamp}`],
  targetCustomers: ["QA"], sdgGoals: [13, 12], sdgPrimary: 13,
  impactDescription: "QA impact claim: this business reduces single-use packaging waste across supply chains by a measurable margin.",
});
const pa = await req(a.j, "/api/startups", { method: "POST", body: mk(`QA E2E SDG Alpha ${stamp}`) });
const pb = await req(b.j, "/api/startups", { method: "POST", body: mk(`QA E2E SDG Beta ${stamp}`) });
console.log("profiles:", pa.status, pb.status, "| slug:", pa.body?.slug);

console.log("\n=== SDG LIFECYCLE ===");
const claim1 = await req(a.j, "/api/impact", { method: "POST", body: { action: "submit" } });
log("submit claim", claim1);
const claimId = claim1.body?.claim?.id;
console.log("admin impact notification:", (await req(admin.j, "/api/notifications")).body?.notifications?.some((n) => n.type === "impact_submitted" && String(n.body).includes(stamp)));
log("admin rejects with note", await req(admin.j, `/api/admin/impact/${claimId}`, { method: "POST", body: { action: "rejected", note: "QA E2E: add stronger evidence." } }));
console.log("after reject:", JSON.stringify((await db`select status, review_note from startup_impact_claims where id=${claimId}`)[0]));
console.log("startup review notification:", (await req(a.j, "/api/notifications")).body?.notifications?.some((n) => n.type === "impact_review" && String(n.body).includes("rejected")));
const rejectedProfile = await fetch(base + `/explore/${pa.body.slug}`, { headers: { cookie: ck(a.j) }, redirect: "manual" });
const rejectedHtml = await rejectedProfile.text();
console.log("rejected profile:", rejectedProfile.status, "| shows verified:", rejectedHtml.includes("Verified impact"));

await req(a.j, "/api/startups", { method: "POST", body: { ...mk(`QA E2E SDG Alpha ${stamp}`), impactDescription: "QA impact claim updated with stronger measurement evidence for verification across packaging supply chains." } });
const resubmit = await req(a.j, "/api/impact", { method: "POST", body: { action: "submit" } });
log("resubmit", resubmit);
const verify = await req(admin.j, `/api/admin/impact/${claimId}`, { method: "POST", body: { action: "verified" } });
log("admin verifies", verify);
console.log("after verify:", JSON.stringify((await db`select status, reviewed_by_user_id from startup_impact_claims where id=${claimId}`)[0]));
console.log("verify notification:", (await req(a.j, "/api/notifications")).body?.notifications?.some((n) => n.type === "impact_review" && String(n.body).includes("verified")));
const verifiedProfile = await fetch(base + `/explore/${pa.body.slug}`, { headers: { cookie: ck(a.j) }, redirect: "manual" });
const verifiedHtml = await verifiedProfile.text();
console.log("verified profile:", verifiedProfile.status, "| shows verified:", verifiedHtml.includes("Verified impact"));

console.log("\n=== ROADMAP ===");
const build = await req(a.j, "/api/roadmap", { method: "POST" });
log("build roadmap", build);
const task = await req(a.j, "/api/roadmap/tasks", { method: "POST", body: { title: `QA E2E task ${stamp}`, description: "QA task", priority: "high", dueDate: "2027-03-01" } });
log("create task", task);
const taskId = task.body?.task?.id;
if (taskId) {
  log("complete task", await req(a.j, `/api/roadmap/tasks/${taskId}`, { method: "PATCH", body: { status: "completed" } }));
  log("other user edits task", await req(b.j, `/api/roadmap/tasks/${taskId}`, { method: "PATCH", body: { status: "in_progress" } }));
}
const milestone = await req(a.j, "/api/roadmap/milestones", { method: "POST", body: { title: `QA E2E milestone ${stamp}`, targetDate: "2027-04-01" } });
log("create milestone", milestone);
const milestoneId = milestone.body?.milestone?.id;
if (milestoneId) log("achieve milestone", await req(a.j, `/api/roadmap/milestones/${milestoneId}`, { method: "PATCH", body: { status: "achieved" } }));
console.log("roadmap row:", JSON.stringify((await db`select t.title, t.status, m.title milestone, m.status milestone_status from roadmap_tasks t left join roadmap_milestones m on m.user_id=t.user_id where t.user_id=(select id from users where email=${A})`)[0]));
const pageA = await fetch(base + "/knowledge-hub/roadmap", { headers: { cookie: ck(a.j) }, redirect: "manual" });
const htmlA = await pageA.text();
const pageB = await fetch(base + "/knowledge-hub/roadmap", { headers: { cookie: ck(b.j) }, redirect: "manual" });
const htmlB = await pageB.text();
console.log("roadmap pages:", pageA.status, pageB.status, "| A sees task:", htmlA.includes(`QA E2E task ${stamp}`), "| B sees A task:", htmlB.includes(`QA E2E task ${stamp}`));

console.log("\n=== CLEANUP ===");
try {
  await db`delete from notifications where body ilike ${"%QA E2E%"}`;
  const del = await db`delete from users where email like ${"qa.e2e.%"}`;
  console.log("deleted users:", del.count);
} catch (error) { console.log("cleanup error:", error.message); }
console.log("baseline:", JSON.stringify((await db`select (select count(*) from users)::int users,(select count(*) from startups)::int startups,(select count(*) from startup_impact_claims)::int claims,(select count(*) from roadmap_tasks)::int tasks,(select count(*) from roadmap_milestones)::int milestones,(select count(*) from notifications)::int notifications`)[0]));
await db.end({ timeout: 2 });
