/**
 * Apply pending Supabase migrations to a FRESH Supabase Cloud project over a
 * direct Postgres connection, sharing the `deploy_schema_migrations` ledger
 * with scripts/apply-hetzner-migrations.mjs.
 *
 * WHY THIS EXISTS ---------------------------------------------------------------------------
 * The cloud project ref in .env.production was verified 2026-10-19 to be live
 * but empty (0 of 93 sync-contract tables). The operator designated it the
 * future production target (docs/ENV-PRODUCTION-REPOINT-20261019.md), and the
 * Hetzner runner cannot serve it: that one shells `ssh + docker exec psql`,
 * which only reaches the self-hosted box. This script is the same ledger
 * contract over a `pg` client.
 *
 * Fail-loudly and fresh-target-only, like its Hetzner twin: the destructive
 * 20260401000000 bootstrap is admitted ONLY when the target public schema has
 * zero tables (ledger table excluded from the count), and even then only with
 * --include-bootstrap.
 *
 * DRY RUN IS READ-ONLY: without --apply this script issues SELECTs only — it
 * never creates the ledger table.
 *
 * USAGE
 *   JF_CLOUD_PG_CONNECTION='postgres://user:pw@host:5432/postgres' \
 *   JF_CLOUD_PG_CA_FILE=/absolute/path/supabase-root-2021-ca.pem \
 *     node scripts/apply-cloud-supabase-migrations.mjs                 # read-only dry run
 *   ... node scripts/apply-cloud-supabase-migrations.mjs --apply       # apply everything pending
 *   ... node scripts/apply-cloud-supabase-migrations.mjs --apply --include-bootstrap   # fresh target ONLY
 *   ... node scripts/apply-cloud-supabase-migrations.mjs --apply --only 20261019000000
 *
 * JF_CLOUD_PG_CA_FILE is required for Supabase Cloud: its Postgres TLS chain
 * terminates at the private "Supabase Root 2021 CA" (no OS trust store carries
 * it, no AIA extension fetches it), so without it verification fails with
 * SELF_SIGNED_CERT_IN_CHAIN. Download it from Dashboard -> Settings -> Database.
 * JF_CLOUD_PG_SSL=off is for a local throwaway container only, never a cloud target.
 *
 * APPLYING IS A HUMAN ACTION (AI AUTOMATION POLICY, human-only list).
 * The connection string is read from the environment and NEVER printed.
 * Core logic + its Jest coverage: scripts/lib/applyCloudSupabaseMigrations.core.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import {
  LEDGER_BOOTSTRAP_SQL,
  LIVE_TABLE_COUNT_SQL,
  LEDGER_EXISTS_SQL,
  planPending,
  guardBootstrap,
  buildTlsOptions,
  parseOnlyFlag,
  readAppliedVersions,
  runPlan,
} from './lib/applyCloudSupabaseMigrations.core.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// MIGRATIONS_DIR lets the suite and operators point at an alternate SQL set;
// default is the repo's own supabase/migrations.
const migrationsDir = process.env.MIGRATIONS_DIR
  ? path.resolve(process.env.MIGRATIONS_DIR)
  : path.join(rootDir, 'supabase', 'migrations');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const includeBootstrap = args.includes('--include-bootstrap');
const { only, error: onlyError } = parseOnlyFlag(args);
if (onlyError) {
  console.error(`  ❌ ${onlyError}`);
  process.exit(2);
}

const connStr = process.env.JF_CLOUD_PG_CONNECTION || process.env.DATABASE_URL;
if (!connStr) {
  console.error('Missing JF_CLOUD_PG_CONNECTION (libpq URI). Never printed by this script.');
  process.exit(2);
}

// Redaction: scrub the full DSN AND the userinfo password substring from any
// text before printing (pg/libpq errors can echo pieces of the connection).
let passwordHint = '';
try {
  passwordHint = decodeURIComponent(new URL(connStr.replace(/^postgres(ql)?/, 'http')).password || '');
} catch {
  /* unparseable — full-string replaceAll still applies */
}
function redact(text) {
  let out = String(text).replaceAll(connStr, '(connection string redacted)');
  if (passwordHint) out = out.replaceAll(passwordHint, '(password redacted)');
  return out;
}
function targetLabel() {
  try {
    const x = new URL(connStr.replace(/^postgres(ql)?/, 'http'));
    return `${x.hostname}:${x.port || 5432}${x.pathname}`;
  } catch {
    return '(unparseable — not printed)';
  }
}

// TLS setup. Supabase Cloud's Postgres chain terminates at its own private
// "Supabase Root 2021 CA", which no OS trust store carries, so verification
// only succeeds once the operator downloads that CA from
// Dashboard -> Settings -> Database and points JF_CLOUD_PG_CA_FILE at it.
// Verification is never disabled: the DSN password would cross the public
// internet unauthenticated otherwise.
function tlsForTarget() {
  const sslMode = process.env.JF_CLOUD_PG_SSL || 'verify-full';
  let caPem = null;
  const caFile = process.env.JF_CLOUD_PG_CA_FILE;
  if (caFile) {
    if (!fs.existsSync(caFile)) {
      console.error(`  ❌ JF_CLOUD_PG_CA_FILE points at a missing file: ${caFile}`);
      process.exit(2);
    }
    caPem = fs.readFileSync(caFile, 'utf8');
  }
  let host;
  try {
    host = new URL(connStr.replace(/^postgres(ql)?/, 'http')).hostname;
  } catch {
    host = undefined;
  }
  return buildTlsOptions({ sslMode, host, caPem });
}

async function main() {
  const client = new Client({
    connectionString: connStr,
    ssl: tlsForTarget(),
    connectionTimeoutMillis: 20000,
  });
  console.log(`\n☁️  Supabase Cloud migration runner — target ${targetLabel()}`);
  try {
    await client.connect();
  } catch (err) {
    console.error(`  ❌ connect failed: ${redact(err.message)}`);
    console.error('     For SELF_SIGNED_CERT_IN_CHAIN: download the CA certificate from');
    console.error('     Dashboard -> Settings -> Database and set JF_CLOUD_PG_CA_FILE to it.');
    console.error('     Supabase signs pooler/direct certs with its own "Supabase Root 2021 CA".');
    console.error('     Never disable verification; the DSN password would cross unverified TLS.');
    process.exit(1);
  }

  try {
    // 1. READ-ONLY probes first, before any ledger DDL: counting after
    //    CREATE TABLE made every fresh target look non-empty (review B1).
    const { rows: [{ n: liveTableCount }] } = await client.query(LIVE_TABLE_COUNT_SQL);
    const { rows: [{ ex: ledgerExists }] } = await client.query(LEDGER_EXISTS_SQL);
    const applied = ledgerExists ? await readAppliedVersions(client) : new Set();

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    const queue = planPending({ files, applied, includeBootstrap, only });

    console.log(`  · ${files.length} migration file(s) in ${migrationsDir === path.join(rootDir, 'supabase', 'migrations') ? 'supabase/migrations' : 'MIGRATIONS_DIR'}, ${applied.size} recorded on target, ${liveTableCount} live public table(s)${liveTableCount > 0 ? ' (ledger excluded from count)' : ''}`);

    if (includeBootstrap) {
      const verdict = guardBootstrap({ includeBootstrap, liveTableCount });
      if (!verdict.allowed) {
        console.error(`  ❌ bootstrap refused: ${verdict.reason}`);
        process.exit(1);
      }
      if (apply) console.log('  ⚠ --include-bootstrap accepted: destructive bootstrap will run first.');
    }

    if (!queue.length) {
      console.log('\n✅ Nothing pending.');
      return;
    }

    console.log('');
    for (const { version } of queue) console.log(`  → ${version}${apply ? '' : '   [dry run: not applied]'}`);

    if (!apply) {
      console.log('\nDry run — read-only: nothing was written to the database. Re-run with --apply (human action).');
      return;
    }

    await client.query(LEDGER_BOOTSTRAP_SQL);
    const readFile = (name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8');
    const summary = await runPlan({ queue, client, readFile, apply: true, allowBootstrap: includeBootstrap });
    for (const v of summary.applied) console.log(`  ✓ ${v} applied and recorded`);
    console.log('\n✅ Plan applied. Next: node scripts/verify-sync-integrity.mjs --production (after .env repoint).');
  } catch (err) {
    console.error(`\n❌ ${redact(err.stack || err.message)}`);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch { /* already dead */ }
  }
}

main();
