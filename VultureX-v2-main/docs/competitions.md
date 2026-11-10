# Competitions module

Competitions are investor-hosted challenges that startups enter with their
existing VultureX profile. The module is an additive extension of the current
platform: it reuses the same authentication, user/startup/investor tables,
notification bell, dashboard shell and visual tokens.

## Routes

| Route | Who | Purpose |
| --- | --- | --- |
| `/competitions` | public | Active, Upcoming, Past Winners, Host tabs |
| `/competitions/[id]` | public / signed-in | Details, eligibility, apply, private management links |
| `/competitions/applications` | startup | Own applications and outcomes |
| `/competitions/host` | investor | New proposal form |
| `/competitions/host/[id]` | hosting investor | Resume a draft or changes-requested proposal |
| `/competitions/manage` | investor | Owned competitions and application counts |
| `/competitions/manage/[id]` | hosting investor | Applicants, evaluation, status changes, winner proposal |
| `/admin/competitions` | admin | Pending / changes / approved / published / rejected / completed views |
| `/admin/competitions/[id]` | admin | Full review, publish, phase changes, winner approval |

APIs live under `/api/competitions` and `/api/admin/competitions`; every handler
resolves the actor from the NextAuth session and re-reads `users.role` from the
database, so a forged role or URL cannot escalate access.

## Lifecycle

```
draft -> pending_review -> approved -> (publish) -> scheduled | open
             |  ^                             -> closed -> under_evaluation -> completed
             v  |
     changes_requested / rejected
```

- Editing is allowed only in `draft` and `changes_requested`.
- Submission requires a title, summary, description, category, opening date,
  deadline, ordered dates and criteria weights that total exactly 100%.
- Only an admin can approve. Only an approved competition can be published, and
  publishing is what notifies startups and makes the competition public.
- Whether applications are accepted is derived from `publishedAt`, `openAt`
  and `deadline` together with the stored status, so a stale UI cannot apply
  after the deadline.
- Winner announcements are approved separately (`winner_announcement_status`);
  winners are only public once approved and `published_at` is set on each row.
- Approving a winner announcement moves the competition to `completed` and
  records the completion timestamp.

## Data model

`competitions` is the pre-existing table, extended with additive nullable
columns (host, schedule, prize details, eligibility, criteria, SDG goals, rules,
review fields, publication fields, winner-announcement approval fields). The
legacy `description`, `sector`, `prize`, `deadline` and `status` columns are
reused. Pre-existing rows keep working; rows with a `NULL` status are backfilled
to `completed` before the column becomes `NOT NULL`.

New tables:

- `competition_applications` — one row per startup per competition (unique
  index), frozen profile snapshot, status and weighted score.
- `competition_evaluations` — one private evaluation per investor per
  application, with per-criterion scores and private notes.
- `competition_winners` — proposed placements, approval state, publication time.
- `competition_events` — append-only audit trail.

`notifications` gained `competition_id` and `application_id` plus a partial
unique index that guarantees exactly one `competition_published` notification
per startup per competition.

Migration: [`db/migrations/0003_greedy_thunderbolt_ross.sql`](../db/migrations/0003_greedy_thunderbolt_ross.sql).
It is additive (three relaxations/defaults only) and never deletes data.

## Security model

VultureX authenticates with NextAuth and talks to Supabase Postgres through
Drizzle using a server-only `DATABASE_URL`. There is no browser-side Supabase
client, so authorization is enforced in the server layer:

- startups read only their own applications; the public detail endpoint returns
  `application: null` for every other startup;
- investors can only manage competitions where `host_investor_id` matches their
  own investor profile (checked on every read and write);
- admins are verified from `users.role`, never from a client-supplied value;
- publication, review decisions, evaluations and winner approvals are all
  server mutations with ownership checks;
- RLS is enabled on the new tables and `competitions` with no policies, so the
  anon/authenticated PostgREST roles cannot read them even if the schema is
  exposed. The application's owner connection bypasses RLS.

## Configuration

The module adds no environment variables and no services. It uses the existing
Supabase database. Set the project's pooler connection string as
`DATABASE_URL` (the same variable the rest of the app already uses):

```
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Then apply the migration:

```bash
pnpm install
pnpm db:migrate
```

Alternatively execute `0003_greedy_thunderbolt_ross.sql` in the Supabase SQL
editor as the project owner. Do not disable RLS, truncate tables or replace the
project URL. The publishable key in `.env` is not used by this data layer.

## Notifications

Publication notifies eligible startup profiles only. The fan-out runs each
startup through the same `evaluateEligibility` rules used by the apply route
(stage, sector, revenue, region, SDG and verified-impact requirements), so an
ineligible or incomplete profile never receives a publication notification.
Investors are notified of applications, review decisions and winner publication;
applicants are notified of status changes; admins are notified of new proposals
and winner proposals.
All notifications reuse the existing bell and unread counters.

## Known limitations

- Email notifications are not sent for competitions; the existing in-app bell is
  the notification channel.
- Banner images are referenced by URL; there is no upload pipeline for them.
- The admin applicant overview shows up to 100 applications per competition;
  the investor applicant list is paginated.
- Rankings and VultureScore are intentionally untouched by competition results.
