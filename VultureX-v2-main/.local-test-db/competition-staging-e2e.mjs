import postgres from "postgres";

const base = "http://127.0.0.1:3000";
const stamp = Date.now().toString(36);
const ADMIN = { email: "qa.admin.staging@vulturex.test", password: "qa-staging-admin-123" };
const INV = `qa.stage.inv.${stamp}@vulturex.test`;
const OK = `qa.stage.ok.${stamp}@vulturex.test`;
const NO = `qa.stage.no.${stamp}@vulturex.test`;
const PASS = "qa-stage-pass-123";
const db = postgres("postgres://postgres:postgres@127.0.0.1:55432/vulturex_replay", {
  max: 1,
  prepare: false,
});

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
const log = (l, r) => console.log(`[${r.status}] ${l}: ${JSON.stringify(r.body).slice(0, 160)}`);

for (const [e, r] of [[INV, "investor"], [OK, "startup"], [NO, "startup"]]) {
  await req(jar(), "/api/auth/signup", { method: "POST", body: { email: e, password: PASS, name: `QA ${r}`, role: r } });
}
const inv = await login(INV, PASS, "investor");
const ok = await login(OK, PASS, "startup");
const no = await login(NO, PASS, "startup");
const admin = await login(ADMIN.email, ADMIN.password, "admin");
console.log("sessions:", { inv: inv.ok, eligible: ok.ok, ineligible: no.ok, admin: admin.ok });

log("investor profile", await req(inv.j, "/api/investors", { method: "POST", body: { fullName: "QA Staging Investor", investorType: "vc", firmName: "QA Staging VC", stageFocus: ["seed"], sectorFocus: ["climate"] } }));
const mk = (name, sector) => ({
  name, tagline: "QA staging", sector, stage: "seed", location: "QA",
  problem: "QA problem.", solution: "QA solution.", mrr: 100000, monthlyGrowth: 5,
  activeUsers: 10, customers: 2, teamSize: 2, founderName: "QA Founder",
  offerings: [`qa-stage-offer-${stamp}`], needs: [`qa-stage-need-${stamp}`],
  targetCustomers: ["QA"],
});
const pOk = await req(ok.j, "/api/startups", { method: "POST", body: mk(`QA Stage Eligible ${stamp}`, "climate") });
const pNo = await req(no.j, "/api/startups", { method: "POST", body: mk(`QA Stage Ineligible ${stamp}`, "fintech") });
console.log("profiles:", pOk.status, pNo.status);

const comp = {
  title: `QA Stage Competition ${stamp}`,
  summary: "QA staging competition summary.",
  description: "QA staging competition with a complete description and rules.",
  category: "climate",
  openAt: new Date(Date.now() - 86400000).toISOString(),
  deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
  evaluationEndsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
  criteria: [{ key: "impact", label: "Impact", weight: 60 }, { key: "team", label: "Team", weight: 40 }],
  prizeAmount: 1000,
  prizeCurrency: "USD",
  eligibility: { allStages: false, stages: ["seed"], sectors: ["climate"] },
};
const draft = await req(inv.j, "/api/competitions", { method: "POST", body: comp });
log("draft", draft);
const compId = draft.body?.id;
await req(inv.j, `/api/competitions/${compId}`, { method: "PATCH", body: { ...comp, submit: true } });
log("submit", await req(inv.j, `/api/competitions/${compId}`, { method: "PATCH", body: { ...comp, submit: true } }));
const pageAdmin = await fetch(base + "/admin/competitions", { headers: { cookie: ck(admin.j) }, redirect: "manual" });
console.log("admin review page:", pageAdmin.status, "| listed:", (await pageAdmin.text()).includes(comp.title));
log("admin approve", await req(admin.j, `/api/admin/competitions/${compId}`, { method: "PATCH", body: { action: "approve" } }));
const pub = await req(admin.j, `/api/admin/competitions/${compId}`, { method: "PATCH", body: { action: "publish" } });
log("admin publish", pub);
console.log("publication row:", JSON.stringify((await db`select status, published_at is not null published from competitions where id=${compId}`)[0]));

const okNotifications = await req(ok.j, "/api/notifications");
const noNotifications = await req(no.j, "/api/notifications");
console.log("eligible notified:", okNotifications.body?.notifications?.some((n) => n.type === "competition_published" && String(n.body).includes(stamp)));
console.log("ineligible notified:", noNotifications.body?.notifications?.some((n) => n.type === "competition_published" && String(n.body).includes(stamp)));

const list = await fetch(base + "/competitions", { headers: { cookie: ck(ok.j) }, redirect: "manual" });
console.log("public competitions page:", list.status, "| listed:", (await list.text()).includes(comp.title));
const apply = await req(ok.j, `/api/competitions/${compId}/apply`, { method: "POST", body: { coverNote: "QA staging application" } });
log("eligible applies", apply);
const appId = apply.body?.id;
log("duplicate apply", await req(ok.j, `/api/competitions/${compId}/apply`, { method: "POST", body: { coverNote: "again" } }));
log("ineligible applies", await req(no.j, `/api/competitions/${compId}/apply`, { method: "POST", body: { coverNote: "nope" } }));

log("investor evaluates", await req(inv.j, `/api/competitions/applications/${appId}`, { method: "PATCH", body: { action: "evaluate", scores: { impact: 80, team: 90 }, notes: "QA staging evaluation" } }));
console.log("evaluation row:", JSON.stringify((await db`select weighted_score, notes from competition_evaluations where application_id=${appId}`)[0]));

// Close applications in staging so winners can be proposed.
await db`update competitions set deadline = now() - interval '1 hour', status = 'closed' where id=${compId}`;
log("admin starts evaluation", await req(admin.j, `/api/admin/competitions/${compId}`, { method: "PATCH", body: { action: "start_evaluation" } }));
const winner = await req(inv.j, `/api/competitions/${compId}/winners`, { method: "POST", body: { applicationId: appId, placement: 1, awardLabel: "QA Winner", prizeNote: "QA prize" } });
log("propose winner", winner);
log("admin approves winner", await req(admin.j, `/api/admin/competitions/${compId}/winner-approval`, { method: "PATCH", body: { action: "approve" } }));
console.log("final competition:", JSON.stringify((await db`select status, winner_announcement_status from competitions where id=${compId}`)[0]));
console.log("winner row:", JSON.stringify((await db`select status, placement, award_label from competition_winners where competition_id=${compId}`)[0]));

const detail = await fetch(base + `/competitions/${compId}`, { headers: { cookie: ck(ok.j) }, redirect: "manual" });
console.log("competition detail:", detail.status, "| winner shown:", (await detail.text()).includes("QA Winner"));
const past = await fetch(base + "/competitions?tab=winners", { headers: { cookie: ck(ok.j) }, redirect: "manual" });
const pastHtml = await past.text();
console.log("past winners tab:", past.status, "| competition:", pastHtml.includes(comp.title), "| winner:", pastHtml.includes("QA Winner"));
console.log("startup winner notification:", (await req(ok.j, "/api/notifications")).body?.notifications?.some((n) => n.type === "competition_winner_announced" && String(n.body).includes("placed #1")));
console.log("investor winner notification:", (await req(inv.j, "/api/notifications")).body?.notifications?.some((n) => n.type === "competition_winner_announced"));

console.log("\n=== STAGING CLEANUP ===");
await db`delete from competitions where id=${compId}`;
const del = await db`delete from users where email like ${"qa.stage.%"}`;
console.log("deleted staging QA users:", del.count);
console.log("staging leftovers:", JSON.stringify((await db`select (select count(*) from competitions)::int competitions,(select count(*) from competition_applications)::int applications,(select count(*) from competition_winners)::int winners,(select count(*) from notifications)::int notifications`)[0]));
await db.end({ timeout: 2 });
