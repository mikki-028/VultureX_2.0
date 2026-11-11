import { databaseUrl, testPassword, adminCreds } from "./config.mjs";
import postgres from "postgres";

const base = "http://127.0.0.1:3000";
const stamp = Date.now().toString(36);
const PASS = testPassword();
const ADMIN = adminCreds();
const emails = {
  inv: `qa.rem.inv.${stamp}@vulturex.test`,
  a: `qa.rem.a.${stamp}@vulturex.test`,
  b: `qa.rem.b.${stamp}@vulturex.test`,
  c: `qa.rem.c.${stamp}@vulturex.test`,
};
const db = postgres(databaseUrl(), {
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
  const text = await r.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 160); }
  return { status: r.status, body: parsed, headers: r.headers };
}
async function login(email, password, role) {
  const j = jar();
  const csrf = await req(j, "/api/auth/csrf");
  const r = await fetch(base + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: ck(j) },
    body: new URLSearchParams({ csrfToken: csrf.body.csrfToken, email, password, role, redirect: "false", callbackUrl: base + "/" }),
    redirect: "manual",
  });
  store(j, r);
  return { j, ok: ck(j).includes("authjs.session-token") };
}
async function signup(email, role) {
  return req(jar(), "/api/auth/signup", { method: "POST", body: { email, password: PASS, name: `QA ${role}`, role } });
}
async function page(j, path) {
  const r = await fetch(base + path, { headers: { cookie: ck(j) }, redirect: "manual" });
  return { status: r.status, text: await r.text() };
}
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const admin = await login(ADMIN.email, ADMIN.password, "admin");
check("admin login", admin.ok);
for (const [key, email] of Object.entries(emails)) await signup(email, key === "inv" ? "investor" : "startup");
const inv = await login(emails.inv, PASS, "investor");
const a = await login(emails.a, PASS, "startup");
const b = await login(emails.b, PASS, "startup");
const c = await login(emails.c, PASS, "startup");
check("QA logins", inv.ok && a.ok && b.ok && c.ok);

const profile = (name, offerings, needs) => ({
  name, tagline: "QA staging", sector: "saas", stage: "seed", location: "Delhi",
  problem: "QA problem.", solution: "QA solution.", mrr: 100000, monthlyGrowth: 5,
  activeUsers: 10, customers: 2, teamSize: 2, founderName: "QA Founder",
  offerings, needs, targetCustomers: ["QA"],
});
await req(inv.j, "/api/investors", { method: "POST", body: { fullName: "QA Reminder Investor", investorType: "vc", firmName: "QA VC", stageFocus: ["seed"], sectorFocus: ["saas"] } });
const pA = await req(a.j, "/api/startups", { method: "POST", body: profile(`QA A ${stamp}`, ["cloud ledger"], ["growth advisory"]) });
const pB = await req(b.j, "/api/startups", { method: "POST", body: profile(`QA B ${stamp}`, ["growth advisory"], ["cloud ledger"]) });
const pC = await req(c.j, "/api/startups", { method: "POST", body: profile(`QA C ${stamp}`, ["legal templates"], ["design help"]) });
check("startup profiles", [pA, pB, pC].every((r) => r.status === 201));
const [rowA] = await db`select id, user_id from startups where user_id = (select id from users where email=${emails.a})`;
const [rowB] = await db`select id, user_id from startups where user_id = (select id from users where email=${emails.b})`;
const [rowC] = await db`select id, user_id from startups where user_id = (select id from users where email=${emails.c})`;
const [invRow] = await db`select id from investors where user_id = (select id from users where email=${emails.inv})`;

// ---------------------------------------------------------------- language
const founderPayload = {
  preferredLanguage: "hi", location: "Delhi", currentObjective: null,
  challenges: [], guidanceAreas: [], priorities: [], learningInterests: [],
  fundingInterest: null, marketingNeeds: [], collaborationInterests: [],
  recommendationTypes: ["resources"],
  reminderPreferences: { inApp: true, email: false, taskDue: true, milestones: true, clinics: true },
  profileVisibility: true, collaborationVisibility: "private", onboardingComplete: true,
};
const founderSaved = await req(a.j, "/api/founder-profile", { method: "PUT", body: founderPayload });
check("founder profile saved (Hindi)", founderSaved.status === 200, founderSaved.body?.profile?.preferredLanguage);
const hiPage = await page(a.j, "/knowledge-hub");
const hiSection = await page(a.j, "/knowledge-hub/start-business");
check("Hindi Knowledge Hub render", hiPage.status === 200 && hiPage.text.includes("ज्ञान केंद्र") && hiPage.text.includes("स्टार्टअप बनाने के लिए"), `status ${hiPage.status}`);
check("Hindi quick access and start-here labels", hiPage.text.includes("स्टार्टअप गाइड") && hiPage.text.includes("अपना चरण तय करें") && !hiPage.text.includes("kh.quick."));
check("Hindi section chrome render", hiSection.status === 200 && hiSection.text.includes("रास्ता") && hiSection.text.includes("अगला कदम"));
const paSave = await req(a.j, "/api/preferences/language", { method: "PATCH", body: { preferredLanguage: "pa" } });
const paPage = await page(a.j, "/knowledge-hub");
const paForYou = await page(a.j, "/knowledge-hub/for-you");
check("Punjabi persisted through quick switch", paSave.status === 200 && paSave.body?.preferredLanguage === "pa");
check("Punjabi Knowledge Hub render", paPage.status === 200 && paPage.text.includes("ਗਿਆਨ ਕੇਂਦਰ") && paPage.text.includes("ਸਟਾਰਟਅੱਪ ਬਣਾਉਣ"));
check("Punjabi For You render", paForYou.status === 200 && paForYou.text.includes("ਤੁਹਾਡੇ ਲਈ") && paForYou.text.includes("ਤੁਹਾਡੇ ਅਗਲੇ ਤਿੰਨ ਕਦਮ") && paForYou.text.includes("ਸੰਭਾਲੇ ਸਰੋਤ ਅਤੇ ਰਿਮਾਈਂਡਰ") && !paForYou.text.includes("foryou."));
await req(a.j, "/api/preferences/language", { method: "PATCH", body: { preferredLanguage: "en" } });
const root = await page(a.j, "/knowledge-hub");
check("low-bandwidth bootstrap present", root.text.includes("vx-lite") && root.text.includes("data-saver"));

// ---------------------------------------------------------- recommendations
const recs = await req(a.j, "/api/recommendations");
const recB = recs.body?.items?.find((item) => item.startup.id === rowB.id);
check("complementary recommendation generated", recs.status === 200 && Boolean(recB), JSON.stringify(recs.body?.items?.map((i) => i.startup.name)));
if (recB) {
  const dismiss = await req(a.j, "/api/recommendations", { method: "POST", body: { targetStartupId: rowB.id, action: "dismiss" } });
  const allAfter = await req(a.j, "/api/recommendations");
  const dismissed = await req(a.j, "/api/recommendations?view=dismissed");
  check("dismiss removes from active list", dismiss.status === 200 && !allAfter.body.items.some((i) => i.startup.id === rowB.id));
  check("dismissed view retains item", dismissed.body.items.some((i) => i.startup.id === rowB.id));
  const a2 = await login(emails.a, PASS, "startup");
  const afterLogin = await req(a2.j, "/api/recommendations?view=dismissed");
  check("dismissal survives logout/login", afterLogin.body.items.some((i) => i.startup.id === rowB.id));
  const restore = await req(a2.j, "/api/recommendations", { method: "POST", body: { targetStartupId: rowB.id, action: "restore" } });
  const restored = await req(a2.j, "/api/recommendations");
  check("restore returns active recommendation", restore.status === 200 && restored.body.items.some((i) => i.startup.id === rowB.id));
  const save = await req(a2.j, "/api/recommendations", { method: "POST", body: { targetStartupId: rowB.id, action: "save" } });
  const savedView = await req(a2.j, "/api/recommendations?view=saved");
  check("save persists in saved view", save.status === 200 && savedView.body.items.some((i) => i.startup.id === rowB.id));
  await req(a2.j, "/api/recommendations", { method: "POST", body: { targetStartupId: rowB.id, action: "unsave" } });
}
const recNotif = await req(a.j, "/api/notifications");
check("recommendation notification persisted", recNotif.body?.notifications?.some((n) => /match/i.test(n.type)));

// --------------------------------------------------------------- Interest+
const sent = await req(a.j, "/api/connections", { method: "POST", body: { userId: rowB.user_id, message: "QA interest" } });
const requestId = sent.body?.request?.id;
check("Interest+ sent", sent.status === 201 && Boolean(requestId));
check("duplicate Interest+ blocked", (await req(a.j, "/api/connections", { method: "POST", body: { userId: rowB.user_id } })).status === 409);
check("outsider cannot accept", (await req(c.j, `/api/connections/${requestId}`, { method: "PATCH", body: { action: "accept" } })).status === 403);
const accepted = await req(b.j, `/api/connections/${requestId}`, { method: "PATCH", body: { action: "accept" } });
const conversationId = accepted.body?.conversationId;
check("recipient accepts and gets conversation", accepted.status === 200 && Boolean(conversationId));
check("thread visible to participant", (await req(a.j, `/api/messages/${conversationId}`)).status === 200);
check("outsider cannot read thread", [403, 404].includes((await req(c.j, `/api/messages/${conversationId}`)).status));
const message = await req(a.j, `/api/messages/${conversationId}`, { method: "POST", body: { body: "Hello from QA A" } });
check("message sent in accepted connection", message.status === 201);
const bThread = await req(b.j, `/api/messages/${conversationId}`);
check("message visible to recipient", bThread.status === 200 && JSON.stringify(bThread.body).includes("Hello from QA A"));
const notifB = await req(b.j, "/api/notifications");
check("Interest+ notification persisted", notifB.body?.notifications?.some((n) => n.type === "interest_request"));

// withdraw + decline flows
const sentC = await req(a.j, "/api/connections", { method: "POST", body: { userId: rowC.user_id, message: "QA cancel" } });
const requestC = sentC.body?.request?.id;
const withdrawn = await req(a.j, `/api/connections/${requestC}`, { method: "PATCH", body: { action: "withdraw" } });
check("sender can withdraw pending request", withdrawn.status === 200);
const resent = await req(a.j, "/api/connections", { method: "POST", body: { userId: rowC.user_id, message: "QA again" } });
const requestC2 = resent.body?.request?.id ?? requestC;
check("withdrawn request can be resent", resent.status === 201);
const declined = await req(c.j, `/api/connections/${requestC2}`, { method: "PATCH", body: { action: "reject" } });
check("recipient can decline", declined.status === 200);
check("declined sender cannot resend", (await req(a.j, "/api/connections", { method: "POST", body: { userId: rowC.user_id } })).status === 403);
check("request_rejected notification persisted", (await req(a.j, "/api/notifications")).body?.notifications?.some((n) => n.type === "request_rejected"));

// ------------------------------------------------------- saved + bookmarks
const KEY = "/knowledge-hub/start-business";
const saved = await req(a.j, "/api/saved-resources", { method: "POST", body: { key: KEY } });
const dupSaved = await req(a.j, "/api/saved-resources", { method: "POST", body: { key: KEY } });
const savedList = await req(a.j, "/api/saved-resources");
check("saved resource created", saved.status === 201);
check("duplicate saved resource prevented", dupSaved.status === 200 && savedList.body.resources.filter((r) => r.resourceKey === KEY).length === 1);
check("saved resource isolated", !(await req(b.j, "/api/saved-resources")).body.resources.some((r) => r.resourceKey === KEY));
check("saved resource removed", (await req(a.j, `/api/saved-resources?key=${encodeURIComponent(KEY)}`, { method: "DELETE" })).status === 200 && !(await req(a.j, "/api/saved-resources")).body.resources.some((r) => r.resourceKey === KEY));

const bm = await req(inv.j, "/api/bookmarks", { method: "POST", body: { startupId: rowA.id } });
const bmDup = await req(inv.j, "/api/bookmarks", { method: "POST", body: { startupId: rowA.id } });
const bmList = await req(inv.j, "/api/bookmarks");
check("bookmark created", bm.status === 200 && bmList.body.bookmarks.some((row) => row.startupId === rowA.id));
check("duplicate bookmark idempotent", bmDup.status === 200);
check("bookmark isolated", !(await req(b.j, "/api/bookmarks")).body.bookmarks.some((row) => row.startupId === rowA.id));
check("bookmark removed", (await req(inv.j, "/api/bookmarks", { method: "DELETE", body: { startupId: rowA.id } })).status === 200 && !(await req(inv.j, "/api/bookmarks")).body.bookmarks.some((row) => row.startupId === rowA.id));

// --------------------------------------------------------------- reminders
const reminder = await req(a.j, "/api/reminders", { method: "POST", body: { title: "QA reminder", description: "initial", dueDate: "2030-01-01", dueTime: "12:00" } });
const reminderId = reminder.body?.reminder?.id;
check("reminder created", reminder.status === 201 && Boolean(reminderId));
const editedReminder = await req(a.j, `/api/reminders/${reminderId}`, { method: "PATCH", body: { title: "QA reminder edited", dueDate: "2030-02-02" } });
check("reminder edited", editedReminder.status === 200 && editedReminder.body.reminder.title === "QA reminder edited");
check("reminder ownership isolated (edit)", (await req(b.j, `/api/reminders/${reminderId}`, { method: "PATCH", body: { title: "hijack" } })).status === 404);
check("reminder ownership isolated (delete)", (await req(b.j, `/api/reminders/${reminderId}`, { method: "DELETE" })).status === 404);
const due = await req(a.j, "/api/reminders", { method: "POST", body: { title: "QA overdue", dueDate: "2020-01-01" } });
await req(a.j, "/api/notifications");
check("due reminder notification", (await req(a.j, "/api/notifications")).body?.notifications?.some((n) => n.type === "reminder_due"));
check("reminder deleted", (await req(a.j, `/api/reminders/${reminderId}`, { method: "DELETE" })).status === 200);
if (due.body?.reminder?.id) await req(a.j, `/api/reminders/${due.body.reminder.id}`, { method: "DELETE" });

// ---------------------------------------------------------------- roadmap
const task = await req(a.j, "/api/roadmap/tasks", { method: "POST", body: { title: "QA custom task", description: "test", category: "QA", priority: "medium", dueDate: "2030-03-03" } });
const taskId = task.body?.task?.id;
check("custom roadmap task created", task.status === 201 && Boolean(taskId));
const completed = await req(a.j, `/api/roadmap/tasks/${taskId}`, { method: "PATCH", body: { status: "completed" } });
check("task status persisted", completed.status === 200 && completed.body.task.status === "completed");
check("task ownership isolated (edit)", (await req(b.j, `/api/roadmap/tasks/${taskId}`, { method: "PATCH", body: { status: "not_started" } })).status === 404);
check("custom task deleted", (await req(a.j, `/api/roadmap/tasks/${taskId}`, { method: "DELETE" })).status === 200);
const roadmapAfter = await req(a.j, "/api/roadmap");
check("deleted task absent after refresh", !JSON.stringify(roadmapAfter.body).includes("QA custom task"));
check("other founder cannot delete task", (await req(b.j, `/api/roadmap/tasks/${taskId}`, { method: "DELETE" })).status === 404);
const milestone = await req(a.j, "/api/roadmap/milestones", { method: "POST", body: { title: "QA milestone", description: "qa", targetDate: "2030-04-04" } });
const milestoneId = milestone.body?.milestone?.id;
check("milestone created", milestone.status === 201 && Boolean(milestoneId));
const achieved = await req(a.j, `/api/roadmap/milestones/${milestoneId}`, { method: "PATCH", body: { status: "achieved" } });
check("milestone achieved", achieved.status === 200 && achieved.body.milestone.status === "achieved");
check("milestone ownership isolated", (await req(b.j, `/api/roadmap/milestones/${milestoneId}`, { method: "PATCH", body: { status: "planned" } })).status === 404);
check("roadmap page renders", (await page(a.j, "/knowledge-hub/roadmap")).status === 200);

// ------------------------------------------------------- pitch deck reject
const [deckRequest] = await db`
  insert into pitch_deck_requests (startup_id, user_id, title, status, current_batch, answers)
  values (${rowB.id}, ${rowB.user_id}, ${`QA rejected deck ${stamp}`}, 'pending_approval', 3, '{}'::jsonb)
  returning id
`;
const reject = await req(admin.j, `/api/admin/pitch-deck/requests/${deckRequest.id}/reject`, { method: "POST", body: { reason: "Please add verified traction metrics." } });
check("admin rejects with reason", reject.status === 200 && reject.body.request.status === "rejected" && reject.body.request.adminNote === "Please add verified traction metrics.");
const [deckRow] = await db`select status, admin_note from pitch_deck_requests where id=${deckRequest.id}`;
const [eventRow] = await db`select actor_role, actor_id, created_at from pitch_deck_events where request_id=${deckRequest.id} and type='rejected' limit 1`;
check("rejection persisted with reviewer event", deckRow.status === "rejected" && eventRow?.actor_role === "admin" && Boolean(eventRow?.actor_id) && Boolean(eventRow?.created_at));
const deckPage = await page(b.j, `/pitch-decks/${deckRequest.id}`);
check("founder sees rejection reason", deckPage.status === 200 && deckPage.text.includes("Please add verified traction metrics."));
check("rejection notification persisted", (await req(b.j, "/api/notifications")).body?.notifications?.some((n) => String(n.body).includes("Please add verified traction metrics.")));
check("repeat rejection blocked", (await req(admin.j, `/api/admin/pitch-deck/requests/${deckRequest.id}/reject`, { method: "POST", body: { reason: "again" } })).status === 409);
const upload = await fetch(base + `/api/admin/pitch-deck/requests/${deckRequest.id}/upload`, { method: "POST", headers: { cookie: ck(admin.j) }, body: new FormData() });
check("upload blocked after rejection", upload.status === 409);
check("publish blocked after rejection", (await req(admin.j, `/api/admin/pitch-deck/requests/${deckRequest.id}/publish`, { method: "POST", body: { fileId: crypto.randomUUID() } })).status === 409);
check("admin status change blocked after rejection", (await req(admin.j, `/api/admin/pitch-deck/requests/${deckRequest.id}/status`, { method: "POST", body: { status: "approved" } })).status === 409);
const reopen = await req(b.j, `/api/pitch-deck/requests/${deckRequest.id}`, { method: "PATCH", body: { action: "revise" } });
check("founder can reopen rejected request", reopen.status === 200 && reopen.body.request.status === "pending_approval");

// ------------------------------------------------------------------ cleanup
await db`delete from users where email like ${"qa.rem.%"} or email like ${"qa.stage.%"}`;
console.log("staging leftovers:", JSON.stringify((await db`select
  (select count(*) from users)::int users,
  (select count(*) from startups)::int startups,
  (select count(*) from competitions)::int competitions,
  (select count(*) from pitch_deck_requests)::int decks,
  (select count(*) from notifications)::int notifications`)[0]));
await db.end({ timeout: 2 });
