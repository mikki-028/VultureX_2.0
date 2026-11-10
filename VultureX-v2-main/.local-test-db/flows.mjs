import fs from "node:fs";

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

const startup = cookieHeader(".local-test-db/cookies/startup.txt");
const investor = cookieHeader(".local-test-db/cookies/investor.txt");
const admin = cookieHeader(".local-test-db/cookies/admin.txt");

async function call(label, path, { cookie, method = "GET", body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      cookie: cookie ?? "",
      "content-type": "application/json",
      accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 160).replace(/\s+/g, " ");
  }
  console.log(`\n[${res.status}] ${label}`);
  console.log(typeof parsed === "string" ? parsed : JSON.stringify(parsed).slice(0, 500));
  return { status: res.status, body: parsed };
}

console.log("========== AUTH / SIGNUP ==========");
await call("signup missing fields", "/api/auth/signup", { method: "POST", body: { email: "x@y.z" } });
await call("signup short password", "/api/auth/signup", {
  method: "POST",
  body: { email: "qa-new@vulturex.test", password: "123", role: "startup" },
});
await call("signup admin role rejected", "/api/auth/signup", {
  method: "POST",
  body: { email: "qa-admin2@vulturex.test", password: "qa-pass-123", role: "admin" },
});
const created = await call("signup valid startup", "/api/auth/signup", {
  method: "POST",
  body: { email: "qa-new@vulturex.test", password: "qa-pass-123", name: "QA Founder", role: "startup" },
});
await call("signup duplicate email", "/api/auth/signup", {
  method: "POST",
  body: { email: "qa-new@vulturex.test", password: "qa-pass-123", role: "startup" },
});

console.log("\n========== ROADMAP ==========");
const roadmap = await call("build roadmap", "/api/roadmap", { cookie: startup, method: "POST" });
await call("roadmap page", "/knowledge-hub/roadmap", { cookie: startup });

console.log("\n========== INTEREST+ -> CONNECTION ==========");
const startups = await call("list startups (investor)", "/api/startups", { cookie: investor });
const target = Array.isArray(startups.body)
  ? startups.body.find((s) => s.slug === "greenpath") ?? startups.body[0]
  : null;
console.log("target startup:", target && `${target.slug} ${target.id}`);
if (target) {
  await call("send Interest+", "/api/interest", {
    cookie: investor,
    method: "POST",
    body: { startupId: target.id, message: "QA: interested in your traction." },
  });
  await call("duplicate Interest+", "/api/interest", {
    cookie: investor,
    method: "POST",
    body: { startupId: target.id, message: "QA duplicate" },
  });
  const received = await call("startup sees received", "/api/interest", { cookie: startup });
  const interest = Array.isArray(received.body?.interests)
    ? received.body.interests.find((i) => i.status === "pending") ?? received.body.interests[0]
    : null;
  console.log("interest id:", interest && interest.id);
  if (interest) {
    await call("accept Interest+", "/api/interest", {
      cookie: startup,
      method: "PATCH",
      body: { interestId: interest.id, status: "accepted" },
    });
    await call("startup conversations", "/api/messages", { cookie: startup });
    await call("investor conversations", "/api/messages", { cookie: investor });
  }
  await call("investor cannot accept (ownership)", "/api/interest", {
    cookie: investor,
    method: "PATCH",
    body: { interestId: interest?.id, status: "accepted" },
  });
}

console.log("\n========== SCORE ==========");
await call("recompute score", "/api/score", {
  cookie: startup,
  method: "POST",
  body: { startupId: target?.id },
});

console.log("\n========== ADMIN PERMISSIONS ==========");
await call("startup hits admin API", "/api/admin/impact", { cookie: startup });
await call("investor hits admin API", "/api/admin/impact", { cookie: investor });
await call("admin hits admin page", "/admin", { cookie: admin });

console.log("\n========== FOUNDER PROFILE ==========");
await call("founder profile empty body", "/api/founder-profile", {
  cookie: startup,
  method: "PUT",
  body: {},
});
await call("founder profile load", "/api/founder-profile", { cookie: startup });
