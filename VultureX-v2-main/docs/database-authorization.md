# Database authorization

Status: **application-layer checks implemented and tested; RLS is not protecting
the application today because `DATABASE_URL` uses a role that bypasses RLS.**

## Current model

The app uses Drizzle over direct PostgreSQL. Every protected API route validates
the NextAuth session, derives the user ID from the session (never from a
client-supplied owner ID), then scopes the query or mutation by that user ID or
by verified membership.

Tested ownership boundaries include:

- competitions and host-only management;
- startup applications and duplicate prevention;
- evaluation and winner review;
- pitch-deck requests, files and publication access;
- saved resources, bookmarks, reminders and roadmap tasks/milestones;
- recommendations, Interest+ requests, conversations and messages;
- SDG claims and admin review.

Conversation access intentionally returns 404 to non-participants. Admin routes
check the admin role before mutating.

This is the effective security boundary in the current deployment. HTTP 200
alone is not treated as authorization evidence; the staging suite exercises
cross-account requests.

## Why RLS is not the current boundary

The configured `postgres` role has `BYPASSRLS` (or is the table owner). Enabling
policies without changing the connection role would therefore provide no
protection for application queries. The application must not claim that RLS is
active until the connection role changes and policy tests pass.

## Proposed production strategy (requires owner approval)

1. Create a login role `vulturex_app` with `NOBYPASSRLS` and only
   `CONNECT`, `USAGE` on `public`, and the table/sequence privileges the app
   needs. Keep schema changes on a separate migration/owner role.
2. Enable RLS on every user-owned table: startups, investors, founder profiles,
   saved resources, bookmarks, reminders, roadmap tasks/milestones, interests,
   connection requests, conversations, participants, messages, notifications,
   applications, evaluations, winners, pitch-deck requests/files and SDG claims.
3. Write policies that mirror the tested predicates: owner by `user_id`, startup
   member/owner, investor owner, conversation participant, competition host,
   application owner, admin-only review. Use `auth.uid()`-equivalent values
   passed as session settings only after the app role is verified; do not trust
   client IDs.
4. Keep public read policies explicit and limited to published competitions,
   public startup/investor directory fields and published decks.
5. Run a two-account isolation matrix and an admin matrix against the new role
   in staging. Only then change production `DATABASE_URL`, with rollback and
   monitoring.
6. Do not enable RLS or alter production roles in the same change as a schema
   migration. This work was intentionally not applied without approval.
