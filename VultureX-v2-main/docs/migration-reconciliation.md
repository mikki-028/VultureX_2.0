# Migration reconciliation

Status: **migration chain repaired and replay-verified; company journal not baselined.**

## What changed

Migration `0002_interest_plus_messaging.sql` contained a backfill that selected
`iu."user_id"` and `su."user_id"` from `users`, whose key column is `id`. The
backfill now uses `iu."id"` and `su."id"` in both the selected columns and the
pair key. No other SQL changed.

The disposable replay runner (`.local-test-db/apply-migrations.mjs`) no longer
rewrites SQL in memory. A replay now proves the repository migration itself is
executable.

## Verification

- Fresh database: `vulturex_verify` (local embedded PostgreSQL only).
- Apply every SQL file in `db/migrations` in filename order.
- Expected: all eleven migrations (`0000`–`0010`) complete without patching.
- The database is disposable and is never the company Supabase project.

## Legacy tables

The company database contains two tables that the current migration chain does
not create:

| Table | Classification | Action |
| --- | --- | --- |
| `profiles` | Obsolete predecessor of `startups` / `migrate`-era data | Leave in place; no application query references it. Do not drop without approval. |
| `pitch_decks` | Obsolete predecessor of `decks` / the pitch-deck request workflow | Leave in place; no application query references it. Do not drop without approval. |

They are legacy remnants, not missing schema for current features. Recreating
them in the migration chain would make a fresh database carry dead tables, so
they are intentionally excluded. If the company owner wants them removed, that
requires a separate reviewed, backed-up migration.

## Drizzle journal

The company database does not have a verified Drizzle journal. This work does
**not** insert journal rows, baseline the company database or run
`db:push`/`drizzle-kit migrate` against it.

Future migrations should:

1. Be generated in a branch and reviewed as SQL.
2. Be replayed against a fresh disposable database with the no-patch runner.
3. Be applied to company only after the owner approves the exact journal
   baseline and migration set.
4. Never use `db:push` against the company project.

The journal baseline remains an explicit approval item, not an assumed step.
