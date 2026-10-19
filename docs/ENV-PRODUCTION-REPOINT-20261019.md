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
2. **No Postgres DDL path from this workstation.**
   `db.<ref>.supabase.co` does not resolve (NXDOMAIN), and session poolers
   in six regions all return `tenant/user postgres.<ref> not found` from a
   clean WSL network path — likely Connection Protection / trusted-IP or a
   non-default hostname. Windows itself also MITMs port 5432 TLS
   (self-signed chain); WSL passes TLS fine, so run DB automation from WSL.
   Needs the exact "Connection string (URI)" copied from
   Dashboard → Settings → Database → Connection string.
3. **Project is empty.** 0/93 contract tables, 0 PostgREST relations,
   0 auth users, `downloads` bucket has no objects. Provisioning means
   applying all 67 files in `supabase/migrations/` (including
   `20261019000000_sync_push_repair_production_drift.sql`), then
   `supabase/seed.sql` policy decisions, then the `downloads` bucket + APK.

⚠ The secret key and DB password were pasted into chat. Rotate both in the
dashboard once provisioning works.

Next automation step (agent-doable once 1-2 are resolved): a
`scripts/apply-cloud-supabase-migrations.mjs` mirroring the
`deploy_schema_migrations` ledger semantics of the Hetzner path, with a
dry-run mode, TDD-first. Applying it stays a human action.


