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

// What the sync-repair migrations are supposed to produce, checked against the live catalog.
const EXPECTED_COLUMNS = {
    app_collectors: ['commission_rate', 'member_id'],
    employees: ['name', 'role', 'base_salary'],
    device_registry: ['deleted_at'],
    statutory_rates: ['deleted_at']
};

function psql(sql, { input = null, label = 'psql', bare = false } = {}) {
    const flags = bare ? '-t -A' : '-q';
    const command = `ssh ${HETZNER_SSH} "docker exec -i supabase-db psql -U postgres -d postgres ${flags} -v ON_ERROR_STOP=1"`;
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
    console.log('\n🔎 Live schema check (read-only)');
    const present = new Set();

    for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
        const rows = psql(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name IN (${columns.map((c) => `'${c}'`).join(',')});`,
            { label: `column probe ${table}`, bare: true }
        );
        rows.forEach((row) => present.add(`${table}.${row}`));
    }

    const missing = [];
    for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
        for (const column of columns) {
            if (!present.has(`${table}.${column}`)) missing.push(`${table}.${column}`);
            console.log(`  ${present.has(`${table}.${column}`) ? '✓' : '✗'} ${table}.${column}`);
        }
    }

    const [fkCount] = psql(
        `SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND conrelid = 'public.app_payrolls'::regclass AND confrelid = 'public.app_employees'::regclass;`,
        { label: 'foreign key probe', bare: true }
    );
    const [payrolls] = psql('SELECT count(*) FROM public.app_payrolls;', { label: 'legacy payload probe', bare: true });
    const [employees] = psql('SELECT count(*) FROM public.app_employees;', { label: 'legacy employee probe', bare: true });

    console.log(`  ${Number(fkCount) === 0 ? '✓' : '✗'} app_payrolls -> app_employees foreign key removed (found ${fkCount})`);
    console.log(`  · legacy payload size: app_payrolls=${payrolls} rows, app_employees=${employees} rows`);

    if (missing.length || Number(fkCount) !== 0) {
        if (missing.length) console.error(`\n❌ still missing: ${missing.join(', ')}`);
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
