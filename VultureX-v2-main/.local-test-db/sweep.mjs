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

const roles = {
  startup: ".local-test-db/cookies/startup.txt",
  investor: ".local-test-db/cookies/investor.txt",
  admin: ".local-test-db/cookies/admin.txt",
};

const routes = {
  startup: [
    "/dashboard",
    "/explore",
    "/explore/greenpath",
    "/rankings",
    "/discover",
    "/investors",
    "/competitions",
    "/competitions/applications",
    "/settings",
    "/interests",
    "/messages",
    "/saved",
    "/pitch-decks",
    "/deck",
    "/onboarding/startup",
    "/knowledge-hub/for-you",
    "/knowledge-hub/for-you/profile",
    "/knowledge-hub/for-you/saved",
    "/knowledge-hub/for-you/reminders",
    "/knowledge-hub/roadmap",
  ],
  investor: [
    "/dashboard",
    "/discover",
    "/explore",
    "/rankings",
    "/investors",
    "/interests",
    "/messages",
    "/saved",
    "/settings",
    "/competitions",
    "/knowledge-hub/for-you",
  ],
  admin: [
    "/admin",
    "/admin/competitions",
    "/admin/pitch-decks",
    "/admin/impact",
    "/dashboard",
  ],
};

const apis = {
  startup: [
    "/api/startups",
    "/api/competitions",
    "/api/notifications",
    "/api/messages",
    "/api/messages/unread",
    "/api/recommendations",
    "/api/roadmap",
    "/api/saved-resources",
    "/api/reminders",
    "/api/founder-profile",
    "/api/interest",
    "/api/bookmarks",
  ],
  investor: ["/api/investors", "/api/recommendations", "/api/notifications", "/api/interest"],
  admin: ["/api/notifications", "/api/admin/competitions"],
};

const markers = [
  "Application error",
  "Internal Server Error",
  "This page could not be found",
  "Something went wrong",
];

for (const [role, jar] of Object.entries(roles)) {
  const cookie = cookieHeader(jar);
  console.log(`\n### ${role} pages`);
  for (const path of routes[role]) {
    try {
      const res = await fetch(base + path, {
        headers: { cookie, "user-agent": "qa-sweep" },
        redirect: "manual",
      });
      const text = await res.text();
      const hit = markers.filter((m) => text.includes(m));
      const title = (text.match(/<title>([^<]*)<\/title>/) || [])[1] ?? "";
      console.log(
        `${res.status} ${path} bytes=${text.length}${hit.length ? " MARKERS=" + hit.join("|") : ""}${title ? " title=" + title : ""}`
      );
    } catch (error) {
      console.log(`ERR ${path} ${error.message}`);
    }
  }

  console.log(`### ${role} APIs`);
  for (const path of apis[role]) {
    try {
      const res = await fetch(base + path, {
        headers: { cookie, accept: "application/json" },
        redirect: "manual",
      });
      const text = await res.text();
      console.log(`${res.status} ${path} type=${res.headers.get("content-type")} body=${text.slice(0, 120).replace(/\s+/g, " ")}`);
    } catch (error) {
      console.log(`ERR ${path} ${error.message}`);
    }
  }
}

console.log("\n### unauthorised API access (no cookie)");
for (const path of ["/api/notifications", "/api/messages", "/api/roadmap", "/api/founder-profile"]) {
  const res = await fetch(base + path, { redirect: "manual" });
  console.log(`${res.status} ${path}`);
}
