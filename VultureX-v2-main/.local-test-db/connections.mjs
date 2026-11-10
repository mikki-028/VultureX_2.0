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

async function call(label, path, { cookie, method = "GET", body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { cookie: cookie ?? "", "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 120).replace(/\s+/g, " ");
  }
  console.log(`\n[${res.status}] ${label}`);
  console.log(JSON.stringify(parsed).slice(0, 700));
  return { status: res.status, body: parsed };
}

const startups = await call("startups list", "/api/startups", { cookie: investor });
const target = startups.body.find((s) => s.slug === "greenpath");
console.log("\nfounder userId:", target.userId);

console.log("\n========== SEND / DUPLICATE ==========");
await call("send Interest+ (connections API)", "/api/connections", {
  cookie: investor,
  method: "POST",
  body: { userId: target.userId, message: "QA connection request" },
});
await call("duplicate request", "/api/connections", {
  cookie: investor,
  method: "POST",
  body: { userId: target.userId, message: "duplicate" },
});
await call("self request (should fail)", "/api/connections", {
  cookie: investor,
  method: "POST",
  body: { userId: "self" },
});

console.log("\n========== STARTUP INBOX ==========");
const overview = await call("startup overview", "/api/connections", { cookie: startup });
const incoming =
  overview.body?.incoming?.find((r) => r.status === "pending") ?? overview.body?.incoming?.[0];
console.log("\nrequest id:", incoming && (incoming.id ?? incoming.request?.id));

const requestId = incoming?.id ?? incoming?.request?.id;

if (requestId) {
  console.log("\n========== ACCEPT ==========");
  await call("accept request", `/api/connections/${requestId}`, {
    cookie: startup,
    method: "PATCH",
    body: { action: "accept" },
  });
  const conv = await call("startup conversations", "/api/messages", { cookie: startup });
  const conversation = conv.body?.conversations?.[0];
  console.log("\nconversation id:", conversation?.id);
  if (conversation?.id) {
    await call("send message", `/api/messages/${conversation.id}`, {
      cookie: startup,
      method: "POST",
      body: { body: "QA hello from founder" },
    });
    await call("investor reads thread", `/api/messages/${conversation.id}`, { cookie: investor });
    await call("investor replies", `/api/messages/${conversation.id}`, {
      cookie: investor,
      method: "POST",
      body: { body: "QA reply from investor" },
    });
    await call("outsider thread access (admin)", `/api/messages/${conversation.id}`, {
      cookie: cookieHeader(".local-test-db/cookies/admin.txt"),
    });
  }
  await call("accept twice (idempotency)", `/api/connections/${requestId}`, {
    cookie: startup,
    method: "PATCH",
    body: { action: "accept" },
  });
}
