# Pitch Deck Workflow — implementation report

End-to-end implementation of the Vulture X pitch deck process: the three-batch
questionnaire from `Vulture_X_Pitch_Deck_Questionnaire.pdf`, the editable summary
that merges profile + questionnaire data, founder approval, a secure admin
review/upload/publish pipeline, the startup deck library, and the
improve-or-create-new post-publication workflow.

Everything is backed by the **existing** Drizzle + Postgres (Supabase) database,
the existing NextAuth credentials login, and the existing dashboard/design system.
No separate database or storage project was introduced.

---

## 1. What was implemented

| Area | Where |
| --- | --- |
| Questionnaire definition (3 batches, PDF-exact) | [questionnaire.ts](../features/pitch-deck/questionnaire.ts) |
| Summary merge engine (profile + answers) | [summary.ts](../features/pitch-deck/summary.ts) |
| RBAC / ownership helpers | [access.ts](../features/pitch-deck/access.ts) |
| Upload rules, enums, formatting | [files.ts](../features/pitch-deck/files.ts), [display.ts](../features/pitch-deck/display.ts) |
| Schema (requests, files, events, admin role) | [schema.ts](../db/schema.ts) + [migration 0001](../db/migrations/0001_sweet_the_hunter.sql) |
| Startup APIs | `app/api/pitch-deck/...` |
| Admin APIs | `app/api/admin/pitch-deck/...` |
| Private file streaming | [app/api/files/[id]/route.ts](../app/api/files/%5Bid%5D/route.ts) |
| Questionnaire UI (autosave, validation, conditionals) | [QuestionnaireForm.tsx](../components/pitch-deck/QuestionnaireForm.tsx) |
| Editable + approvable summary UI | [SummaryEditor.tsx](../components/pitch-deck/SummaryEditor.tsx) |
| Admin upload/publish/status controls | [AdminRequestControls.tsx](../components/pitch-deck/AdminRequestControls.tsx) |
| Startup pages | `/pitch-decks`, `/pitch-decks/[id]`, `.../questionnaire`, `.../summary` |
| Admin pages | `/admin`, `/admin/pitch-decks`, `/admin/pitch-decks/[id]` |
| Three-option login | [app/(auth)/login/page.tsx](../app/(auth)/login/page.tsx) |
| Admin provisioning CLI | [db/seed-admin.ts](../db/seed-admin.ts) → `npm run db:seed:admin` |

Preserved as-is: the existing AI deck generator (`/deck`, `/deck/new`,
`/api/deck/generate`), explore, rankings, competitions, interests, saved,
onboarding and settings. The new work is additive; the only edits to existing
files are the role enum, the login screen, the sidebar, middleware, the
dashboard redirect for admins and one extra quick-action card.

---

## 2. How the three batches work

`features/pitch-deck/questionnaire.ts` is the single source of truth.

* **Batch 1 — Business & Market:** Q1A, Q1B, Q1C, **Describe Your Startup (new)**, Q2 (TAM), Q3 (SAM), Q4 (SOM), Q5, Q6, Q7 (+ optional demo link and optional screenshot upload).
* **Batch 2 — Competition & Growth:** Q8 (up to 5 competitors, name required + optional differentiation), Q9 (multi-select moat + optional explanation), Q10 (multi-select acquisition + optional GTM note).
* **Batch 3 — Fundraising & Ask:** Q11 (fundraising status), Q11A (amount, conditional), Q11B (use of funds, conditional, must total exactly 100%), Q11C (conditional text, re-worded for “recently closed a round”), Q12 (contact email, pre-filled from the account).

Wording, order, required/optional flags and field types match the PDF.
`validateBatch()` drives both the UI and the server, so the browser and the API
can never disagree.

**Conditional logic implemented**

* `planning` / `raising` → Q11A + Q11B + Q11C are shown (Q11A/Q11B required).
* `closed` → Q11A shown and required, Q11C re-worded, **no** use-of-funds step.
* `not_raising` → all fundraising follow-ups skipped.
* Use of funds: live `Total: N%`, “Your allocation exceeds 100%.”, “Add N% more to continue.”, Continue blocked until exactly 100%, plus **Auto-fill remainder into Other**.
* Q4: soft TAM ≥ SAM ≥ SOM warning only — never blocks.
* Q8: non-blocking “Add a line to strengthen your Competition slide.” nudge.
* Missing information is flagged, never invented.

**Persistence and resume**

* Every batch is written on **Save and Continue** and by a 1.2 s debounced autosave.
* `currentBatch` is stored, so returning resumes at the right batch (the list page shows “Resume batch N”).
* Answers live in `pitch_deck_requests.answers` (jsonb, keys whitelisted by `sanitizeAnswers`), so refresh/logout/another device all resume correctly.
* Submitting requires all three batches to validate; failures jump the user to the first offending batch.
* Duplicate protection: the create endpoint returns the existing unfinished draft instead of creating another, submit/approve/publish are idempotent, and buttons disable while a request is in flight.

**Describe Your Startup (new question)**

Multiline textarea in Batch 1 with `0/200 words` live counter, a “Trim to 200
words” shortcut offered when a paste exceeds the limit, and blocking validation
(`Reduce your answer to 200 words (currently N).`). No PDF question was removed
or reordered.

---

## 3. How profile data and questionnaire answers are combined

`buildDeckSummary({ startup, answers, screenshotFileId, previousSummary })`
produces a structured `DeckSummary` of 12 sections in deck order:
Company Overview · Problem & Solution · Market Opportunity · Business Model ·
Product & Stage · Traction & Financials · Competition · Defensibility/Moat ·
Go-to-Market · Team · Fundraising & Ask.

Data-source rules, each field carrying `source` (`profile` / `questionnaire` /
`merged` / `missing`), plus immutable `profileValue` and `questionnaireValue`:

* Profile-only facts (MRR, growth, users, customers, total raised, burn, runway, founder, team size, problem, solution, sector, stage, location, website) fill sections the questionnaire never asks about — the PDF’s “never asked again” rule.
* Questionnaire-only facts (TAM/SAM/SOM, ideal customer, business model, moat, GTM, competitors, use of funds) fill the new slides.
* Overlap is **merged, not discarded**: tagline + description become a combined positioning statement; both originals stay visible to the founder and admin.
* Conflicts are flagged, not guessed: e.g. a “recently closed” round larger than the profile’s total raised raises *“The amount you just raised is higher than the total raised on your profile. Confirm which figure is current.”*
* Funding stage (profile) vs product stage (questionnaire) are kept as separate fields with a note explaining the difference.
* Missing values render as *“Not provided — flagged for review”* and produce section warnings.
* Regenerating the summary preserves fields the founder already edited.
* **The merge never writes to `startups`** — profile data is read-only in this flow.

---

## 4. Database, storage and data integrity

New tables (migration `db/migrations/0001_sweet_the_hunter.sql`):

* `pitch_deck_requests` — startup/user ownership, `kind` (`new` | `revision`), `previous_request_id` + `version` (revision chain), `status`, `current_batch`, `answers`, `summary`, `approved_summary`, `summary_changed_since_approval`, `admin_note`, `submitted_at`, `approved_at`, `revision_requested_at`, `published_at`.
* `pitch_deck_files` — request + startup ownership, `kind` (`deck` | `product_screenshot`), name/mime/size, `content bytea`, `uploaded_by`, `is_published`, `published_at`.
* `pitch_deck_events` — audit trail (created, submitted, summary edited, approved, revision requested, uploaded, published, admin note).
* `users.role` enum extended to `startup | investor | admin`.

**Storage decision.** There is no Supabase Storage SDK or credential in the
project, so uploaded PDF/PPTX (≤ 20 MB) and screenshots (≤ 5 MB) are stored as
`bytea` inside the existing Postgres database and streamed only through
`/api/files/[id]`. Rules: admins see everything; the owning startup sees its own
screenshots and a deck **only after publication**; anyone else gets 404 so ids
cannot be probed. Responses are `Cache-Control: private, no-store`. There is no
public URL for any file. If you later add Supabase Storage, only
`pitch_deck_files` + the two upload routes need to change.

Statuses: `incomplete → pending_approval → approved → in_progress → completed`,
with `summary_changed_since_approval` showing re-opened summaries everywhere.

---

## 5. Admin authorization and publication

* Admins are created **only** by an operator running `npm run db:seed:admin` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`, both required with no default, idempotent so it can promote existing users and rotate passwords). The public signup API still accepts only `startup` / `investor`, so nobody can self-assign admin.
* Login now offers **Startup · Investor · Admin**. The credentials provider requires the selected role to equal the stored role, so a startup/investor cannot sign in through the Admin option, and an admin cannot sign in through another option.
* RBAC is enforced server-side in three places: `/admin` layout guard, `requireAdmin()` in every admin API route, and `loadRequestForActor()` for per-request ownership. Middleware only adds an early session check.
* `/admin` shows platform totals and a **Pitch Deck Requests** entry; `/admin/pitch-decks` filters by All / Unapproved / Approved / In progress / Completed / Incomplete and shows startup, submission, approval and publication dates.
* The request detail page shows the startup profile, the **approved** summary (with a red banner when it changed after approval), the original answers from all three batches, the private screenshot, the full history, and the upload/publish controls.
* Upload: PDF/PPTX only, 20 MB cap, real XHR progress, `Verify file` opens the private copy, and the request moves to `in_progress` but stays unpublished.
* **Publish Pitch Deck** is a separate, explicitly confirmed action that requires an approved summary. It sets `is_published`, unsets any previous published file, records `published_at`, sets the request to `completed`, and logs an event. Uploading alone never publishes.

---

## 6. Startup deck library, revision and new-deck flows

* `/pitch-decks` (“My Pitch Decks”) lists real persisted requests with status badge, title, submission/approval/publication dates, progress bar and `currentBatch` while incomplete, admin notes, approved-summary access, and secure view/download once published.
* A startup only ever sees its own requests; every lookup is bound to `startup.userId === session.user.id`.
* **Improve the Existing Pitch Deck** → creates a `revision` request chained by `previousRequestId` with `version + 1`, keeps the published deck untouched, reuses profile data and prior answers where applicable, runs the same three batches, builds a new editable summary, requires approval, and goes through the same admin pipeline. The published deck is only ever un-published for its own request, so history is preserved.
* **Create a New Pitch Deck** → a separate `new` request; the previous request and deck are untouched.
* Closing the loop after publication, the detail page states: *“Your startup information has been submitted successfully. Our team is preparing your pitch deck. Please check your dashboard again within 24–48 hours.”* with status **Pitch Deck In Progress** — no deck is shown before publication.

---

## 7. Setup — current state

**The database is provisioned.** The connected Supabase project
(`dvgtgrpmwkvdinlecmrj`, API URL `https://dvgtgrpmwkvdinlecmrj.supabase.co`)
now holds the full app schema, applied through the Supabase MCP as two
migrations:

| Migration | Contents |
| --- | --- |
| `vulturex_baseline` | `users`, `startups`, `investors`, `decks`, `competitions`, `competition_entries`, `interests`, `profile_views`, `bookmarks`, `deck_views` + FKs/indexes + RLS enabled. `bookmarks` was missing from the committed `0000` migration, so it was included here. |
| `pitch_deck_workflow` | `pitch_deck_requests`, `pitch_deck_files` (bytea), `pitch_deck_events` + FKs/indexes + RLS enabled. |

Accounts seeded (bcrypt hashes, `email_verified = true`):

* `admin@example.com` / `vulturex` — **admin**
* `founder@vulturex.test` / `demo123` — startup, with a “Testing Labs” profile
* `investor@vulturex.test` / `demo123` — investor, with a profile

The two startup/investor accounts are throwaway test data for verifying the
flow; delete them once you no longer need them.

> Do **not** run `npm run db:migrate` / `npm run db:push` against this project —
> the migrations were applied through the MCP, so drizzle’s journal is empty and
> `0000` would try to re-create existing tables. Use the Supabase MCP (or
> `db:push` after a review) for future schema changes.

**RLS posture.** Every app table has RLS enabled with no policies, so the
`anon`/`authenticated` Supabase API roles can read nothing. The Next.js server
connects as the database owner over `DATABASE_URL` (which bypasses RLS) and
enforces access in code — `requireAdmin()`, `loadRequestForActor()` and
`canReadFile()`. The Supabase security advisors report this as INFO-level
“RLS enabled no policy” for all 13 tables, which is the intended configuration;
there are no ERROR or WARN level findings.

**Why a publishable key is not enough.** `sb_publishable_…` (like the legacy
`anon` key) authorises the Supabase *Data API* (PostgREST/Storage) as a
low-privilege role that is subject to RLS. This app does not use the Data API:
`db/index.ts` opens a direct Postgres connection with `postgres-js` and runs
Drizzle queries as the database owner, which is also what lets it bypass RLS and
enforce RBAC in application code. So the server still needs the Postgres
connection string (pooler, port 6543) — and because RLS is enabled with no
policies, the Data API roles can reach nothing at all. If you would rather serve
data through the Data API, that is a different architecture: it needs
`@supabase/supabase-js`, per-table RLS policies, and Supabase Auth instead of the
existing NextAuth credentials provider. The project URL and the publishable key
are in `.env` for that future use; nothing reads them today.

Steps for local use:

1. Put the pooler connection string in `.env` as `DATABASE_URL` (`AUTH_SECRET`, the project URL and the publishable key are already there).
2. `npm run dev` → sign in from `/login` choosing Startup, Investor or Admin.
3. Re-running `npm run db:seed:admin` is safe and idempotent if you ever need to reset the admin password.

## 8. Verification performed

**Static checks**

* `npx tsc --noEmit` — clean.
* `npx eslint .` — 0 errors; every warning is in code this work did not modify (for example the unused `updated` binding in `app/api/score/route.ts`).
* `npx next build` — succeeds; `/admin`, `/admin/pitch-decks`, `/admin/pitch-decks/[id]`, `/pitch-decks*`, `/api/pitch-deck/*`, `/api/admin/pitch-deck/*` and `/api/files/[id]` are all compiled.
* `npx drizzle-kit generate` — produced migration `0001` (bookmarks’ missing baseline was excluded so the migration can be applied to an existing database).
* The committed migrations in `db/migrations/` were replayed against a throwaway PostgreSQL 18.4 server (24 + 17 statements, no errors), so the migration SQL itself is exercised and not merely type-checked.
* Supabase security advisors on the new project: 13 INFO-level `rls_enabled_no_policy`, zero ERROR/WARN.

**Runtime, on a live database** (browser + HTTP API)

* **Login.** All three options are offered, and the credentials provider enforces the selected role — the startup account is refused on the Admin tab — with each role landing on its own page.
* **Founder flow.** New request → three batches → submit → summary. Validation blocks an incomplete batch; the 200-word description cap with “trim to first 200”, the `SOM > SAM` warning, the competitor-differentiation nudge, the conditional “currently raising” follow-ups, the 100%-of-funds rule and the “blocked at 50%” rule all fire as specified.
* **Summary merge.** The generated summary merges profile fields (MRR, team size, founder, problem/solution, raised, burn, runway) with questionnaire answers (TAM/SAM/SOM, model, moat, GTM, use of funds), marks skipped optional fields `Missing`, and editing a profile-backed field writes a copy only — the `startups` row was read back unchanged.
* **Approval.** Approving with an unsaved edit submits the current draft, so the stored `approved_summary` equals exactly what the founder saw; a later edit sets `summary_changed_since_approval`.
* **Admin pipeline.** Upload (PDF) leaves the file private — owner 404, other startup 404, anonymous 401, admin 200 — and moves the request to `in_progress`. Publish demands an explicit `fileId` plus an approved summary, flips the request to `completed`, stamps `published_at`, and unpublishes any earlier deck. Only after publish does the owner get `200 application/pdf` with `Cache-Control: private, no-store` and `nosniff`; the stored bytes match the upload.
* **Access control.** A second startup account is refused everywhere: `/admin` redirects it to `/dashboard`, admin APIs return 403, and the request/summary/file endpoints return 404. Ownership checks and the deliberate 404-not-403 answer for files both hold.
* **Malformed input.** Every id coming from a URL path or a request body passes an `isUuid()` guard (`lib/utils.ts`) before it can reach a `uuid` column, so a bad path id returns 404 and a bad body id returns 400 instead of a 500 `PostgresError`. Covered: `files/[id]`, the three admin pitch-deck routes, `pitch-deck/requests` (path and `previousRequestId`), `deck/[id]`, `competitions/[id]` and `/enter`, `views`, `interest`, `bookmarks`, `score`. This class of defect was found by the runtime pass, not by the compiler.
* **Error handling.** `POST /api/bookmarks` no longer reports every failure as a duplicate: 23505 (already saved) stays idempotent with `200`, 23503 (no such startup) is a `404`, and anything else is logged and returned as a `500`.
* **Known remaining, left unfixed as out of scope.** `GET /api/startups` returns 500 for an out-of-range `limit` (`?limit=99999999999999999999` overflows Postgres int64), and `POST /api/interest` still answers “Interest already expressed” for *any* insert failure rather than only for the duplicate case.
* **Reading a SQLSTATE.** Drizzle wraps driver errors in a `DrizzleQueryError` whose own `code` is `undefined` — the SQLSTATE is on `cause`. Branch on `sqlStateOf()` (`lib/utils.ts`), never on `error.code`, which silently never matches.

**Not verified.** The runtime pass above ran against a local PostgreSQL server,
because the Supabase project’s database password was not available here. The
Supabase project itself is verified only at the schema and seed level (13 tables,
3 accounts, advisors clean). Re-run founder → admin → publish once `DATABASE_URL`
points at the project; nothing in the code path is store-specific, but that has
not been measured.
