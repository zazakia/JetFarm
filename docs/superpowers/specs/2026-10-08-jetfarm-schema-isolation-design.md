# JetFarm Schema Isolation — Design Spec

**Date:** 2026-10-08
**Status:** Approved (Approach A — clean cutover)
**Owner:** user (operator) with Qoder executing each stage under confirmation checkpoints

## Background

The self-hosted Supabase stack on the Hetzner VPS (`supabase.818.quest`) serves several
unrelated apps from a single PostgreSQL `postgres` database. All app tables currently live
in the `public` schema (209 tables at recon time), belonging to at least four ledger apps —
`jetfarm`, `tude-accounting`, `jobflow-app`, `infinityfinance` — plus a `meatshopanti_*`
set and a `crm_*`/`vw_bir_*` franchise-accounting set. Precedent exists for isolation:
`jobflow` already runs in its own schema (`PGRST_DB_SCHEMAS=public,storage,graphql_public,jobflow`).

## Goal

Isolate every JetFarm-owned table and its related objects into a dedicated `jetfarm_db`
schema on the same instance, so JetFarm development, testing, and production administration
are cleanly separated from the other projects.

## Hard constraints

- **Never delete or modify any table, view, function, or policy belonging to another app.**
  Everything not on the audited JetFarm move list stays in `public`, byte-for-byte unchanged.
- `deploy_schema_migrations` (shared cross-app ledger) stays in `public`.
- The instance-level migration-ledger semantics are preserved (the new schema-move migration
  is itself recorded with `app_name = 'jetfarm'`).
- No data rows are moved or rewritten — this is metadata-only (`SET SCHEMA`), instant, and
  reversible.
- Secrets policy unchanged: env var names only in any log/commit; `.env.hetzner` values are
  never printed.

## Known facts from recon (2026-10-08)

- `PGRST_DB_SCHEMAS=public,storage,graphql_public,jobflow` (first entry is the default;
  changing it is forbidden — other apps rely on the `public` default).
- PostgREST container: `supabase-rest`; DB container: `supabase-db`; stack config on VPS:
  `/home/deploy/apps/supabase/docker-compose.yml` + `.env`.
- `postgres` role is not superuser; app objects are owned by `supabase_admin`. Schema moves
  must run as `supabase_admin` (proven during the 2026-10-08 sync-fix deploy).
- JetFarm's own migrations create ~95–100 tables; JetFarm code reaches Supabase exclusively
  through the `supabase` singleton in `src/database/supabase.ts` (`supabase.from(...)`,
  one `.rpc('get_server_time')`), including `SyncService` (dynamic `.from(remoteName)`).
- Client decision confirmed by operator: other apps do not read JetFarm tables (design still
  audits for FK/trigger/policy evidence that contradicts this and excludes conflicted tables).
- Clients in production: web bundle + installed Android APKs; APKs cannot self-update
  (in-app update path is a known broken prod gap), so old APKs will show sync errors until
  reinstalled. Operator accepted this (offline WatermelonDB data is preserved and syncs fine
  after reinstall).

## Design — five stages

### 1. Ownership audit (read-only)

Produce the definitive move list by intersecting:

- `CREATE TABLE` names from `supabase/migrations/**` (JetFarm repo),
- every remote table name in `SyncService.SYNC_TABLES` / `TABLE_MAP` plus other
  `supabase.from(...)` call sites,
- live `public` catalog (`pg_class`), filtered to the intersection above.

Explicit exclusions: `deploy_schema_migrations`; anything owned by another app.

Metadata sweep for each to-move table: owned sequences (`pg_class.relkind='S'` with
`pg_depend` on the column — `ALTER TABLE … SET SCHEMA` does NOT move these), enum/domain
types used by its columns, triggers on it (auto-move), its RLS policies (auto-move), and
bound views.

Function/type attribution rule: move a `public` function or type only if JetFarm created it
(per migrations/scripts grep) **and** no non-moving table's trigger, policy, view, or column
defaults references it (`pg_trigger`, `pg_policies`, `pg_attrdef`, `pg_depend` queries).
`get_server_time`, `set_updated_at`, `get_current_role`, `is_global_admin`,
`enforce_balanced_journal`, `handle_new_user` (auth.users trigger — likely stays), etc. are
classified by evidence, not assumption.

Safety valve: if any FK edge from a non-JetFarm table into a JetFarm table is found, that
JetFarm table is excluded from the move and reported (cross-app dependency evidence
overriding the operator's "independent" statement).

Output: `tmp/systematic-test-matrix/schema-isolation-audit-<date>.md` with the exact table,
sequence, type, function, and view lists.

### 2. Backup + reversible migration

- `pg_dump -Fc` (full DB) via `docker exec supabase-db pg_dump`, pulled to the workstation,
  checksummed, and restore-verified into a scratch database name on the same container
  (`jetfarm_schema_drill_<ts>`, then dropped). Rollback asset for catastrophic cases.
- One new SQL migration file `supabase/migrations/<ts>_jetfarm_schema_isolation.sql`:
  `CREATE SCHEMA jetfarm_db` owned by `supabase_admin`; `GRANT USAGE` to `anon`,
  `authenticated`, `service_role`; `GRANT` table privileges (select/insert/update/delete)
  to the same roles plus `ALTER DEFAULT PRIVILEGES IN SCHEMA jetfarm_db` for future tables;
  then `ALTER TABLE … SET SCHEMA jetfarm_db` for the audited list, `ALTER SEQUENCE`,
  `ALTER TYPE`, `ALTER FUNCTION`, `ALTER VIEW` for the audited satellites — all wrapped in a
  single explicit transaction, ending with `NOTIFY pgrst, 'reload schema'`.
- Companion hand-authored rollback file (inverse `SET SCHEMA public` list) kept in the repo;
  not a ledger migration — an emergency script under `scripts/`.
- Applied as `supabase_admin` (same proven path), version recorded in
  `deploy_schema_migrations` under `jetfarm`.
- Verify after apply: table count in `jetfarm_db` equals audit count; `public` table count
  dropped by exactly that number and still equals the other apps' untouched set (row counts
  of foreign tables unchanged); `psql` sample select through the new schema.

Rollback of this stage: run inverse script (single transaction), reload, done.

### 3. PostgREST exposure

- Edit the stack env so `PGRST_DB_SCHEMAS=public,storage,graphql_public,jobflow,jetfarm_db`
  (`public` must remain first/default). Value edit performed on the VPS `.env` by the operator
  alongside the agent; the agent never prints secret file contents.
- `docker restart supabase-rest` (seconds of REST unavailability for all apps — announced
  checkpoint).
- Verify: `GET /rest/v1/app_settings` with `Accept-Profile: jetfarm_db` returns 200 for a
  JetFarm table and a non-JetFarm table still returns via default `public`.

Rollback: revert env line, restart container.

### 4. JetFarm client change (TDD)

- `src/database/supabase.ts`: add `db: { schema: process.env.EXPO_PUBLIC_SUPABASE_SCHEMA || 'public' }`
  to `createClient` options. Jest RED test asserts the option is forwarded; local dev and the
  emulator keep `public` (no env set), production `.env.hetzner` gains
  `EXPO_PUBLIC_SUPABASE_SCHEMA=jetfarm_db` (operator-applied; agent references the name only).
- SyncService unchanged (all calls flow through the singleton). If the stage-1 audit keeps
  `get_server_time` in `public`, the single `.rpc` call site pins `.schema?` — supabase-js
  v2 `rpc` uses the client default schema, so in that case the rpc call passes an explicit
  override or the function is duplicated into `jetfarm_db`; decision recorded in the audit.
- Gates per project policy (tier for `src/database/` change): eslint, `tsc --noEmit`,
  related Jest suites, `npm run check:sync`, evidence under `tmp/systematic-test-matrix/`.

### 5. Cutover sequence (single maintenance window)

1. Stage 1 audit evidence reviewed and approved by operator. ← gate
2. Backup + restore drill complete.
3. SQL migration applied; DB-state verifications pass.
4. PostgREST env + restart; REST verifications pass. ← first moment JetFarm's tables stop
   resolving in `public` (old web tabs / APKs begin erroring on sync; harmless, self-heals
   after client update)
5. New web bundle deployed (`deploy:hetzner`, explicit operator go at this step) with
   `EXPO_PUBLIC_SUPABASE_SCHEMA` set; live bundle probe confirms the new hash and a real
   login/sync round-trip.
6. Android APK rebuilt and handed to operator for distribution (publication to the
   downloads CDN remains operator-only and currently has the known prod gap).
7. Post-cutover watch: production console/sync logs clean of `404 PGRST205`-style errors;
   sample-data sync (uuid fix, commit `7e6cd4b`) verified pushing to `jetfarm_db`.

Abort/rollback during the window: inverse SQL script + env revert + redeploy previous bundle;
full-DB restore from backup only if metadata rollback itself fails (drill proves it).

## Explicitly out of scope

- Any change to other apps' tables, schemas, configs, or deployments.
- Separating storage buckets, `auth` schema (shared GoTrue), or Kong routes.
- Fixing `apply-hetzner-migrations.mjs` role hardcoding (tracked separately; during this
  operation the agent uses explicit `supabase_admin` invocations).
- Publishing the APK to a CDN (operator action).
- Local emulator layout changes (dev DB keeps using `public`).

## Testing

- Jest RED→GREEN for the client schema option (mock `createClient` and assert options).
- New dry-run script mode for the migration generation (audits repo migrations vs live DB,
  prints the statement list without executing) — verified before touching production.
- Post-apply smoke: sign in, pull, push a change, confirm remote row lands in
  `jetfarm_db` (SQL check), confirm other app endpoint still 200 from `public`.
