import { testPassword } from "./config.mjs";
import fs from "node:fs";

const base = "http://127.0.0.1:3000";
const email = `qa.e2e.probe.${Date.now().toString(36)}@vulturex.test`;
const pass = testPassword();
const jar = new Map();
function store(r) {
  for (const raw of r.headers.getSetCookie?.() ?? []) {
    const [p] = raw.split(";"); const i = p.indexOf("=");
    if (i > 0) jar.set(p.slice(0, i), p.slice(i + 1));
  }
}
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
async function call(path, opts = {}) {
  const r = await fetch(base + path, { ...opts, headers: { "content-type": "application/json", cookie: cookie(), ...(opts.headers || {}) }, redirect: "manual" });
  store(r);
  return { status: r.status, location: r.headers.get("location"), text: await r.text() };
}
await call("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password: pass, name: "QA Probe", role: "startup" }) });
const csrf = JSON.parse((await call("/api/auth/csrf")).text).csrfToken;
await call("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf, email, password: pass, role: "startup", redirect: "false", callbackUrl: base + "/" }) });

const pages = ["/dashboard", "/admin", "/admin/pitch-decks", "/admin/impact", "/admin/competitions", "/messages", "/knowledge-hub/for-you", "/knowledge-hub/for-you/profile"];
console.log("startup session -> protected pages:");
for (const p of pages) {
  const r = await call(p);
  console.log(` ${r.status} ${p}${r.location ? " -> " + r.location : ""}`);
}
console.log("\nstartup session -> founder APIs:");
for (const p of ["/api/founder-profile", "/api/saved-resources", "/api/reminders", "/api/bookmarks", "/api/notifications", "/api/recommendations"]) {
  const r = await call(p);
  console.log(` ${r.status} ${p} ${r.status === 200 ? "(own data)" : r.text.slice(0, 60)}`);
}

// Log out and verify anonymous access.
jar.clear();
console.log("\nanonymous -> pages:");
for (const p of ["/dashboard", "/admin", "/admin/pitch-decks", "/messages", "/knowledge-hub/for-you"]) {
  const r = await call(p);
  console.log(` ${r.status} ${p}${r.location ? " -> " + r.location : ""}`);
}
const anon = await call("/knowledge-hub/for-you");
console.log("anon for-you leaks QA email/name:", anon.text.includes(email) || anon.text.includes("qa.e2e") || anon.text.includes("QA Probe"));
console.log("anon for-you body has sign-in prompt:", /sign in|log in|create.*account/i.test(anon.text));
console.log("\nanonymous -> APIs:");
for (const p of ["/api/founder-profile", "/api/saved-resources", "/api/bookmarks", "/api/notifications", "/api/recommendations", "/api/reminders"]) {
  const r = await call(p);
  console.log(` ${r.status} ${p}`);
}
