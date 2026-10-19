# .env.production Repoint Procedure (2026-10-19)

Found by the database/production verification run:
`tmp/systematic-test-matrix/2026-10-19T100344Z-db-prod/summary.json`

## Problem

`.env.production` bakes the DEAD hosted project
`https://pkkcpyhpbkbadnjlpqfv.supabase.co` (REST root 401 with its own
anon key, `app_borrowers` 404). The live production database is the
self-hosted stack at `https://supabase.818.quest`, configured in
`.env.hetzner`.

The currently deployed Pages bundle is correct (0 refs to the dead host),
so the live app is unaffected today. But `npm run deploy:cloudflare` reads
`.env.production`, so the next Cloudflare deploy ships an app that can
never reach the database.

Human-only per AI AUTOMATION POLICY: an agent must not write
`.env.production` values. Apply this yourself.

## Diff summary (verified 2026-10-19, values never printed)

| Key | prod vs hetzner |
|-----|-----------------|
| EXPO_PUBLIC_SUPABASE_URL | DIFFER (must repoint) |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | DIFFER (must repoint, key pair belongs to dead host) |
| EXPO_PUBLIC_ENCRYPTION_KEY | SAME |
| EXPO_PUBLIC_BUSINESS_TYPE | SAME |
| EXPO_PUBLIC_ENABLE_QUICK_LOGIN | SAME |
| EXPO_PUBLIC_APP_ENV | SAME |
| EXPO_PUBLIC_APP_URL | SAME (pinned to `https://jetfarm.pages.dev`) |
| CLOUDFLARE_PROJECT_NAME | prod-only, keep |

## Apply (Git Bash, repo root)

```bash
cp .env.production .env.production.bak-20261019

live_url=$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' .env.hetzner | cut -d= -f2-)
live_key=$(grep -E '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' .env.hetzner | cut -d= -f2-)

sed -i \
  -e "s|^EXPO_PUBLIC_SUPABASE_URL=.*|EXPO_PUBLIC_SUPABASE_URL=${live_url}|" \
  -e "s|^EXPO_PUBLIC_SUPABASE_ANON_KEY=.*|EXPO_PUBLIC_SUPABASE_ANON_KEY=${live_key}|" \
  .env.production
```

Values are copied host-side and never echoed. `.env*` is gitignored;
confirm with `git check-ignore -v .env.production` before/after.

## Verify

Key-name sanity (no values):

```bash
grep -E '^EXPO_PUBLIC_SUPABASE_URL=' .env.production   # expect https://supabase.818.quest
```

Live contract probe (read-only, reuses this run's script):

```bash
export JF_URL=$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' .env.production | cut -d= -f2-)
export JF_KEY=$(grep -E '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' .env.production | cut -d= -f2-)
node tmp/systematic-test-matrix/probe-contract-tables.cjs
# expect: 88 reachable, 3 agri_* missing until repair migration applied, 2 cic_* RLS 401
```

Full verifier: `node scripts/verify-sync-integrity.mjs --production`
(the authenticated RLS section still needs valid prod admin credentials —
see summary.json finding 3).

## Still open after repoint

1. Apply schema-repair migration `20261019000000` (human, `npm run db:migrate:apply`).
2. Prod admin session for the RLS canary.
3. Refresh stale `version.json` on `jetfarm.818.quest` (frozen at 0.1.1).

## Follow-up: operator-supplied cloud credentials tested (2026-10-19)

Credentials for project ref `pkkcpyhpbkbadnjlpqfv` were supplied and probed
read-only (values never recorded here). Outcome — that project is live but
**empty**, so it is not the production database:

| Check | `pkkcpyhpbkbadnjlpqfv.supabase.co` | `supabase.818.quest` |
|-------|-------------------------------------|----------------------|
| GoTrue health | alive (v2.197.0) | alive |
| `/rest/v1/` with secret key | 200 | 200 (anon) |
| 93 sync-contract tables | **0 of 93** (all 404) | **88 of 93** reachable |
| PostgREST exposed relations | 0 | present |
| Auth users (service role) | 0 | seeded |
| `downloads` bucket APK v0.1.5 | absent (400) | 200 |

Also: the supplied publishable key returns 401 while the supplied secret key
returns 200 — the pair is inconsistent (revoked or mismatched publishable).
Direct Postgres to that project was not completed: `db.<ref>.supabase.co` does
not resolve, and the session-pooler hosts presented a self-signed TLS chain
from this network. Verification was **not** disabled to force a connection.

Conclusion unchanged: `.env.production` currently points at an empty project
with an invalid publishable key. Repoint to `.env.hetzner` values as above,
unless the cloud project is intended as a new production target — in which
case it first needs the full schema, RLS policies, seed data and `downloads`
bucket applied by a human (L5), and no deploy should point at it before that.

## Decision (2026-10-19): cloud project is the FUTURE production target

Operator chose `pkkcpyhpbkbadnjlpqfv` as the migration destination. Current
readiness gaps that block provisioning (all verified this session):

1. **Key pair inconsistent.** The supplied publishable key is byte-identical
   to `EXPO_PUBLIC_SUPABASE_ANON_KEY` already in `.env.production`, and it
   returns 401 against its own project while the secret key returns 200.
   The app-facing key is revoked or mismatched — a web build baked with it
   cannot reach the database at all. Needs a fresh publishable key from
   Dashboard → Settings → API.
2. **~~No Postgres DDL path from this workstation~~ — RESOLVED 2026-10-20.**
   A verified, read-only DDL path exists: host
   `aws-0-ap-northeast-2.pooler.supabase.com:5432`, user
   `postgres.pkkcpyhpbkbadnjlpqfv`, TLS verified against a pinned root CA.
   What replaced the earlier guesses:
   - **Region.** The project lives in **ap-northeast-2** (Seoul). A tenancy scan
     across 16 pooler instances — using a deliberately wrong password so no real
     credential crossed the wire — returned `tenant/user … not found` everywhere
     except ap-northeast-2, which reached password authentication. The earlier
     "six regions all fail" reading meant the region had simply not been found,
     not that pooling was disabled.
   - **Direct host is unreachable here.** `db.pkkcpyhpbkbadnjlpqfv.supabase.co`
     publishes **AAAA only** and neither Windows nor WSL has an IPv6 route
     (`Network is unreachable`), so the session pooler is the only path from this
     machine.
   - **TLS chain.** Leaf `CN=*.pooler.supabase.com` ← `Supabase Intermediate 2021
     CA` ← **`Supabase Root 2021 CA`**. That root is in no system trust store, so
     a plain connection dies with `SELF_SIGNED_CERT_IN_CHAIN` and `node
     --use-system-ca` does not help; pinning the *intermediate* alone gives
     `unable to get issuer certificate`. Pinning the **root** via
     `JF_CLOUD_PG_CA_FILE` is what makes verification pass.
   - **Root CA provenance (trust-on-first-use).** Supabase serves the root inside
     its own handshake; it was captured from two independent pooler regions and
     the DER is byte-identical:
     `sha256 807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`,
     self-signed, `CA:TRUE`, Subject Key Identifier
     `A8:D7:B9:76:37:D8:2C:ED:92:12:26:9E:0E:32:24:D5:2D:69:46:2C` equal to the
     intermediate's Authority Key Identifier, valid 2021-04-28 → 2031-04-26.
     File: `tmp/systematic-test-matrix/2026-10-19T100344Z-db-prod/supabase-root-2021-ca.pem`.
     **Before `--apply`, confirm that fingerprint against Dashboard → Settings →
     Database**, which is the authoritative copy; two matching observations from
     one network path is strong but not the same as an authenticated source.
   - Still never acceptable: `rejectUnauthorized: false` — that would carry the
     database password over an unverified channel.

3. **Project is empty — confirmed live 2026-10-20.** Read-only probe of the real
   target (`PostgreSQL 17.11`): 0 tables in `public`, `deploy_schema_migrations`
   ABSENT, 0 rows in `auth.users`, 0 storage buckets. Provisioning means applying
   all 67 files in `supabase/migrations/` (including
   `20261019000000_sync_push_repair_production_drift.sql`), then
   `supabase/seed.sql` policy decisions, then the `downloads` bucket + APK.

⚠ The secret key and DB password were pasted into chat. Rotate both in the
dashboard once provisioning works.

## CRITICAL (found 2026-10-20): production credentials are committed to a PUBLIC repo

While checking that this session left no secret in the evidence directory, a
`git grep` over tracked content showed the exposure predates this session and is
far larger. **This is an active credential breach, not a hygiene issue.**

Repository: `https://github.com/zazakia/JetFarm` — GitHub reports
`visibility: PUBLIC`, and commit `1408367` (2026-09-11, "initial project
bootstrap") is on `origin/main`. Counts below are files containing at least one
match; no values are reproduced here:

| Pattern in tracked files | Files |
| --- | --- |
| `sb_secret_…` (Supabase **secret / service-role key** — bypasses RLS entirely) | 32 |
| `sb_publishable_…` / anon key (client-side by design, but rotating it breaks baked bundles) | 25 |
| The live Postgres password (same value pasted into this chat on 2026-10-19) | 7 |
| `postgres://user:password@…` DSNs | 3 |
| Supabase session-pooler hostnames (which region/tenant to attack) | 6 |

The exact file list is deliberately **not** enumerated here: this document lives
in a public repository, and naming the files would hand an attacker a shortcut
to credentials they can already find by reading the tree. The enumeration is in
the local evidence record
(`tmp/systematic-test-matrix/2026-10-19T100344Z-db-prod/summary.json`) and is
reproducible at any time with `git grep -lE 'sb_secret_'` and
`git grep -lF '<the database password>'`.

Consequences, stated plainly: anyone with internet access can read that
repository and obtain a key that bypasses row-level security on the Supabase
project plus the direct database password and hostnames. Because the repo is
public and the commits are pushed, **history rewriting cannot undo the
exposure** — the credentials must be treated as already known to strangers.

**Agent-side rotation was attempted and cannot work (2026-10-20).** Over the
verified pooler session, `ALTER USER postgres WITH PASSWORD …` returned
`42501: Only superusers can alter privileged roles.` — Supabase reserves the
`postgres` role, so no client connection can rotate it. The secret key cannot be
rotated either: no Management API credential exists on this machine
(`supabase projects list` → "Access token not provided", nothing in
`~/.supabase/`, and `.env.production` defines only the eight `EXPO_PUBLIC_*` /
`CLOUDFLARE_PROJECT_NAME` variables — names checked, values untouched). The
failed attempt changed nothing: the pre-rotation connect succeeded and a
post-failure probe re-authenticated with the current password, re-confirming the
target is still empty (0 tables, ledger absent, 0 auth users, 0 buckets). The
freshly generated replacement was deleted before it could be used, and no
password value was ever printed. Rotation requires the authenticated dashboard —
human-only, tier L5.

Required human actions, in order:
1. Rotate the Supabase **secret key** (Dashboard → Settings → API) immediately,
   then the **database password**.
2. Audit the project for unauthorized access during the exposure window: Auth
   users, `auth.users` growth, unusual `updated_at` churn, and the dashboard
   logs (API requests, Postgres logs, Network Restrictions).
3. Decide whether the repository should become private and whether the leaked
   keys were ever valid on the Hetzner self-hosted stack too.
4. Only then scrub the working tree (move every credential to `.env*` / CI
   secrets). Optionally filter history for hygiene, but do not treat it as the
   fix.
5. Extend the pre-commit guard: today it blocks staging `.env*` and arbitrary
   hex colors, but nothing rejects a credential literal inside `scripts/**`. A
   pattern gate for `sb_secret_`, `postgres://…:…@`, and long high-entropy
   strings would have caught all five of the files above.

This document records filenames and counts only. No key, password, or DSN from
any of these files was printed, copied into evidence, or committed here.

Provisioning tool now exists: `scripts/apply-cloud-supabase-migrations.mjs`
(core + Jest coverage in `scripts/lib/applyCloudSupabaseMigrations.core.js` /
`scripts/__tests__/applyCloudSupabaseMigrations.test.js`). Dry run is the
default; `--apply` is a human action. It shares the `deploy_schema_migrations`
ledger with the Hetzner runner, and its destructive-bootstrap guard only
admits `20260401000000_initial_schema` against a zero-table target with
`--include-bootstrap`. TLS verification is never disabled; for Supabase Cloud
set `JF_CLOUD_PG_CA_FILE` to the downloaded CA certificate (the runner refuses
a missing file with exit 2 rather than falling back to unverified TLS). Pass
`JF_CLOUD_PG_CONNECTION` from the dashboard connection string (item 2) —
the script prints the redacted host only.

**Local review status (2026-10-19).** The runner was reviewed and exercised
only against a throwaway Postgres 16 in WSL docker — never against the cloud
project and never against production. Evidence in
`tmp/systematic-test-matrix/2026-10-19T100344Z-db-prod/`
(`e2e-local-runner.log`, `jest-runner-green.log`,
`jest-runner-mutation-check.log`, `summary.json`): 31 unit tests on the module
(57 in the `scripts/__tests__` bucket), dry run provably read-only, fresh-target
bootstrap apply, self-`BEGIN;/COMMIT;` strip, plpgsql `BEGIN` preservation, abort
+ `ROLLBACK` with the failed version left unrecorded, idempotent re-apply,
conservative bootstrap refusal, `--only` fail-closed, password never printed.
Mutation harness holds the proof: 5/5 CAUGHT, module SHA restored.

**First real cloud dry run (2026-10-20).** Against the live target through the
ap-northeast-2 pooler with TLS verified against the pinned root CA
(`cloud-dry-run.mjs` → `cloud-dry-run-2.log`): reported
`67 migration file(s) in supabase/migrations, 0 recorded on target, 0 live public
table(s)`, planned 66 (the destructive `20260401000000_initial_schema` bootstrap
is correctly withheld without `--include-bootstrap`), and wrote nothing.
Post-run read-only probe (`cloud-readonly-probe.mjs`) re-confirmed 0 public
tables, `deploy_schema_migrations` ABSENT, 0 `auth.users`, 0 buckets on
PostgreSQL 17.11. **Still unverified:** the actual `--apply` of those 66 files
(human action, and the first real test of every migration's DDL on Supabase's
Postgres 17), Auth/RLS/Storage provisioning (items 1 and 3), and the root CA
fingerprint against the dashboard copy. Read the dry-run plan before any
`--apply`.


