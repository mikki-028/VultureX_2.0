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

async function call(label, path, { method = "GET", body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { cookie: startup, "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 150).replace(/\s+/g, " ");
  }
  console.log(`\n[${res.status}] ${label}`);
  console.log(JSON.stringify(parsed).slice(0, 800));
  return { status: res.status, body: parsed };
}

const payload = {
  location: "Lagos, Nigeria",
  preferredLanguage: "en",
  currentObjective: "raise-funding",
  challenges: ["funding", "marketing"],
  guidanceAreas: ["finance", "strategy"],
  priorities: [],
  learningInterests: [],
  fundingInterest: null,
  marketingNeeds: [],
  collaborationInterests: [],
  recommendationTypes: [],
  profileVisibility: true,
  collaborationVisibility: "network",
  reminderPreferences: { emailOptIn: false, cadence: "weekly", channels: ["in-app"] },
  onboardingComplete: true,
};

await call("save founder profile", "/api/founder-profile", { method: "PUT", body: payload });
const reload = await call("reload founder profile", "/api/founder-profile");
console.log("\npersisted language:", reload.body?.profile?.preferredLanguage, "| objective:", reload.body?.profile?.currentObjective, "| onboardingCompletedAt:", Boolean(reload.body?.profile?.onboardingCompletedAt));

await call("invalid language rejected", "/api/founder-profile", {
  method: "PUT",
  body: { ...payload, preferredLanguage: "xx" },
});

console.log("\n========== REMINDERS ==========");
await call("reminder missing title", "/api/reminders", { method: "POST", body: {} });
await call("reminder with title", "/api/reminders", {
  method: "POST",
  body: { title: "QA reminder", dueDate: new Date(Date.now() + 86400000).toISOString(), type: "task" },
});
await call("reminders list", "/api/reminders");

console.log("\n========== FOR-YOU PAGE AFTER PROFILE ==========");
const page = await fetch(base + "/knowledge-hub/for-you", { headers: { cookie: startup } });
const html = await page.text();
console.log("status:", page.status, "bytes:", html.length);
console.log("mentions 'For You':", html.includes("For You"), "| error markers:", ["Application error", "Internal Server Error"].some((m) => html.includes(m)));
