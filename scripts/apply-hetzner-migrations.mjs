/**
 * Apply pending Supabase migrations to the live Hetzner stack WITHOUT running a deployment.
 *
 * WHY THIS EXISTS ---------------------------------------------------------------------------
 * The only existing path that reaches the production database is Stage 2 of
 * scripts/deploy-hetzner.mjs, which is welded to a full deploy: it swaps .env.hetzner over
 * .env.local for the web export, empties the remote site directory, and re-extracts the bundle.
 * That is the wrong blast radius for "just apply the schema repair" -- a schema fix should not
 * be able to take the site down. This script does Stage 2 and nothing else.
 *
 * It uses the same ledger as the deploy script (`deploy_schema_migrations`, app_name 'jetfarm'),
 * so a migration applied here is not re-applied by a later deploy, and vice versa.
 *
 * It also fails loudly. deploy-hetzner.mjs:101 catches a migration error, prints a warning, and
 * carries on deploying -- which can ship an app against a schema that never got repaired.
 *
 * USAGE
 *   node scripts/apply-hetzner-migrations.mjs                     # status + pending list, writes nothing
 *   node scripts/apply-hetzner-migrations.mjs --apply             # apply every pending migration
 *   node scripts/apply-hetzner-migrations.mjs --apply --only 20260927000000,20261002000000
 *   node scripts/apply-hetzner-migrations.mjs --verify            # read-only column/FK check
 *
 * Connection comes from the SSH alias only (HETZNER_SSH_ALIAS, default `hetzner`). This script
 * reads no credential files, embeds no credentials, and prints none.
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedRemoteColumns, diffAgainstLiveSchema } from './lib/sync-schema-contract.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(rootDir, 'supabase', 'migrations');

const HETZNER_SSH = process.env.HETZNER_SSH_ALIAS || 'hetzner';
const APP_NAME = 'jetfarm';
// The 2026-04-01 bootstrap recreates the schema; it must never reach a live database.
const DESTRUCTIVE_PREFIXES = ['20260401000000_initial_schema'];

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const verifyOnly = args.includes('--verify');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? (args[onlyIdx + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : [];

// What the live database must contain is DERIVED, never listed: every column the local
// WatermelonDB schema pushes, mapped through remoteTableMap, comes from
// scripts/lib/sync-schema-contract.mjs. A pinned list is how this script managed to print
// "every pushed column exists" while production was missing 59 columns.
function psql(sql, { input = null, label = 'psql', bare = false } = {}) {
    const flags = bare ? '-t -A' : '-q';
    const sshOpts = '-o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=10 -o ServerAliveCountMax=3';
    const command = `ssh ${sshOpts} ${HETZNER_SSH} "docker exec -i supabase-db psql -U postgres -d postgres ${flags} -v ON_ERROR_STOP=1"`;
    const result = spawnSync(command, {
        shell: true,
        input: input ?? sql,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024
    });

    if (result.status !== 0) {
        const detail = `${result.stderr || ''}\n${result.stdout || ''}`.trim().split('\n').slice(-8).join('\n');
        throw new Error(`${label} failed (exit ${result.status}):\n${detail}`);
    }

    // psql writes notices/ERRORs to stderr even on a zero exit in some images; surface them,
    // but only return data rows so callers can parse counts.
    if (!bare && result.stderr && result.stderr.trim()) console.log(result.stderr.trim());
    return (result.stdout || '').split('\n').map((line) => line.trim()).filter(Boolean);
}

function ensureLedger() {
    psql(
        'CREATE TABLE IF NOT EXISTS deploy_schema_migrations (app_name text NOT NULL, version text NOT NULL, applied_at timestamptz DEFAULT now(), PRIMARY KEY(app_name, version));',
        { label: 'ledger bootstrap' }
    );
}

function appliedVersions() {
    return new Set(
        psql(`SELECT version FROM deploy_schema_migrations WHERE app_name IN ('${APP_NAME}', 'infinityfinance');`, {
            label: 'ledger read',
            bare: true
        })
    );
}

function localMigrations() {
    return fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
}

function pending() {
    const done = appliedVersions();
    return localMigrations()
        .map((file) => ({ file, version: file.replace(/\.sql$/, '') }))
        .filter(({ version }) => !DESTRUCTIVE_PREFIXES.some((p) => version.startsWith(p)))
        .filter(({ version }) => !done.has(version))
        .filter(({ version }) => (only.length ? only.some((o) => version.startsWith(o)) : true));
}

function verify() {
    console.log('\n🔎 Live schema check (read-only, contract-wide)');

    const expected = expectedRemoteColumns(rootDir);
    const columnRows = psql(
        `SELECT table_name || '.' || column_name FROM information_schema.columns WHERE table_schema = 'public';`,
        { label: 'catalog column probe', bare: true }
    );
    const tableRows = psql(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`,
        { label: 'catalog table probe', bare: true }
    );
    const liveKeys = columnRows.map((row) => row.trim()).filter(Boolean);
    const liveTables = tableRows.map((row) => row.trim()).filter(Boolean);
    const { missingTables, missingColumns, checkedTables } = diffAgainstLiveSchema(expected, liveKeys, liveTables);

    console.log(`  · contract: ${checkedTables} synced table(s), ${liveTables.length} live table(s), ${liveKeys.length} live column(s) probed`);

    for (const table of missingTables) {
        console.log(`  ✗ MISSING TABLE  ${table.localTable} -> ${table.remoteTable} (${table.columns.length} pushed columns)`);
    }
    for (const gap of missingColumns) {
        console.log(`  ✗ COLUMN GAP     ${gap.localTable} -> ${gap.remoteTable}: ${gap.missing.length} missing`);
        console.log(`                 ${gap.missing.join(', ')}`);
    }
    if (!missingTables.length && !missingColumns.length) {
        console.log(`  ✓ every pushed column of every synced table exists remotely`);
    }

    const countRows = psql(
        `SELECT (SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND conrelid = 'public.app_payrolls'::regclass AND confrelid = 'public.app_employees'::regclass) || '|' || (SELECT count(*) FROM public.app_payrolls) || '|' || (SELECT count(*) FROM public.app_employees);`,
        { label: 'batch constraints probe', bare: true }
    );
    const [countsStr = '0|0|0'] = countRows;
    const [fkCount = '0', payrolls = '0', employees = '0'] = countsStr.split('|');

    console.log(`  ${Number(fkCount) === 0 ? '✓' : '✗'} app_payrolls -> app_employees foreign key removed (found ${fkCount})`);
    console.log(`  · legacy payload size: app_payrolls=${payrolls} rows, app_employees=${employees} rows`);

    const gapCount = missingTables.length + missingColumns.length;
    if (gapCount || Number(fkCount) !== 0) {
        if (gapCount) {
            console.error(`\n❌ ${gapCount} synced table(s) still short of what SyncService pushes.`);
            console.error('   The ledger is not evidence: it can record a migration as applied while its');
            console.error('   objects are absent (CREATE TABLE IF NOT EXISTS over an older table, or a');
            console.error('   multi-column ALTER that aborted as one statement). Author a NEW forward-only');
            console.error('   migration -- editing an applied file changes history without changing the database.');
        }
        if (Number(fkCount) !== 0) console.error('❌ the stale foreign key is still in place.');
        return false;
    }

    console.log('\n✅ Repair is live: every pushed column exists and the stale FK is gone.');
    console.log('   Next: node scripts/verify-sync-integrity.mjs --production');
    return true;
}

function main() {
    console.log(`\n🗄️  Hetzner migration runner -- SSH alias: ${HETZNER_SSH}`);
    try {
        const out = execSync(`ssh -o BatchMode=yes -o ConnectTimeout=8 ${HETZNER_SSH} "echo OK"`, { encoding: 'utf8' }).trim();
        if (out !== 'OK') throw new Error(`unexpected output: ${out}`);
        console.log('  ✓ SSH connection is active');
    } catch (err) {
        console.error(`  ❌ Cannot reach the production host over SSH (${HETZNER_SSH}): ${err.message}`);
        console.error('     Set HETZNER_SSH_ALIAS, or run this from the machine holding the deploy key.');
        process.exit(1);
    }

    ensureLedger();
    if (verifyOnly) process.exit(verify() ? 0 : 1);

    const queue = pending();
    console.log(`  · ${localMigrations().length} migration file(s) locally, ${queue.length} pending${only.length ? ` (filtered by --only ${only.join(',')})` : ''}`);

    if (!queue.length) {
        console.log('\n✅ Nothing pending. The live ledger already covers every local migration.');
        process.exit(verify() ? 0 : 1);
    }

    console.log('');
    for (const { version } of queue) console.log(`  → ${version}${apply ? '' : '   [dry run: not applied]'}`);

    if (!apply) {
        console.log('\nDry run -- nothing was sent to the database. Re-run with --apply to execute,');
        console.log('or narrow it: --apply --only 20260927000000,20261002000000');
        process.exit(0);
    }

    for (const { file, version } of queue) {
        console.log(`\n  Applying ${file} ...`);
        psql(null, { input: fs.readFileSync(path.join(migrationsDir, file)), label: `apply ${version}` });
        psql(`INSERT INTO deploy_schema_migrations (app_name, version) VALUES ('${APP_NAME}', '${version}') ON CONFLICT DO NOTHING;`, {
            label: `ledger insert ${version}`
        });
        console.log(`  ✓ ${version} applied and recorded`);
    }

    psql("NOTIFY pgrst, 'reload schema';", { label: 'PostgREST reload' });
    console.log('  ✓ PostgREST schema cache reloaded');

    process.exit(verify() ? 0 : 1);
}

main();
