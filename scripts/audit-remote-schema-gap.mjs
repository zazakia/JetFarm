#!/usr/bin/env node
/**
 * Read-only audit: local WatermelonDB schema columns vs. the live PostgREST
 * schema cache.
 *
 * WHY: SyncService pushes every column the local tableSchema declares
 * (sanitizeRecord only strips _status/_changed, and WatermelonDB's sanitizedRaw
 * fills unset optionals with null). One column missing remotely makes PostgREST
 * reject the whole batch for that table (PGRST204 / 42703), which then cascades
 * into foreign-key 409s on every child table pushed after it. The console noise
 * in production is that failure mode; this script names the exact columns.
 *
 * It performs a single unauthenticated-shape GET of the OpenAPI document and
 * writes evidence. It never writes to the database.
 *
 * Usage:
 *   node scripts/audit-remote-schema-gap.mjs --url https://supabase.example --key <anon-key>
 *   node scripts/audit-remote-schema-gap.mjs --local          # uses .env.local
 *
 * Options:
 *   --table <local-name>   Limit to one local table
 *   --out <dir>            Evidence directory (default tmp/remote-schema-gap)
 */

import path from 'path';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const root = process.cwd();
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const flagValue = name => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
};

if (flag('--help')) {
    console.log(`Usage: node scripts/audit-remote-schema-gap.mjs [--url <origin> --key <anon-key> | --local] [--table <local>] [--out <dir>]`);
    process.exit(0);
}

function loadEnvFile(filePath, override = false) {
    if (!existsSync(filePath)) return;
    for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator < 1) continue;
        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
        if (override || process.env[key] === undefined) process.env[key] = value;
    }
}

if (flag('--local')) loadEnvFile(path.join(root, '.env.local'), true);
loadEnvFile(path.join(root, '.env'), false);

const url = (flagValue('--url') || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = flagValue('--key') || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!url || !key) {
    console.error('Missing Supabase origin or anon key. Pass --url/--key or use --local with .env.local.');
    process.exit(2);
}

// Expectations come from the same module scripts/apply-hetzner-migrations.mjs verifies
// against the SQL catalog, so the two live checks can never drift apart.
const { expectedRemoteColumns, diffAgainstLiveSchema } = await import(
    pathToFileURL(path.join(root, 'scripts', 'lib', 'sync-schema-contract.mjs')).href
);

const allExpected = expectedRemoteColumns(root);
const specificTable = flagValue('--table');
if (specificTable && !allExpected.some((entry) => entry.localTable === specificTable)) {
    console.error(`Unknown local table "${specificTable}".`);
    process.exit(2);
}
const expected = specificTable
    ? allExpected.filter((entry) => entry.localTable === specificTable)
    : allExpected;

const response = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
});
if (!response.ok) {
    console.error(`OpenAPI fetch failed: HTTP ${response.status}`);
    process.exit(2);
}
const spec = await response.json();

// A rowFilter parameter exists for every column PostgREST currently has in its schema cache,
// which is the exact view a sync push is validated against.
const paths = Object.keys(spec?.paths ?? {});
const liveTables = paths.filter((p) => p.startsWith('/')).map((p) => p.slice(1));
const liveKeys = [];
for (const entry of expected) {
    const params = spec?.paths?.[`/${entry.remoteTable}`]?.get?.parameters ?? [];
    const prefix = `#/parameters/rowFilter.${entry.remoteTable}.`;
    for (const param of params) {
        const ref = typeof param === 'string' ? param : param?.$ref ?? '';
        if (ref.startsWith(prefix)) liveKeys.push(`${entry.remoteTable}.${ref.slice(prefix.length)}`);
    }
}

const { missingTables, missingColumns, checkedTables } = diffAgainstLiveSchema(expected, liveKeys, liveTables);
const rows = [
    ...missingTables.map((t) => ({ localTable: t.localTable, remoteTable: t.remoteTable, status: 'missing-remote-table', localColumns: t.columns.length, remoteColumns: 0, missing: [] })),
    ...missingColumns.map((g) => ({ localTable: g.localTable, remoteTable: g.remoteTable, status: 'column-gap', localColumns: g.columns.length, remoteColumns: null, missing: g.missing })),
];

const outDir = path.resolve(root, flagValue('--out') || path.join('tmp', 'remote-schema-gap'));
mkdirSync(outDir, { recursive: true });
const evidence = {
    generatedAt: new Date().toISOString(),
    target: url,
    source: 'OpenAPI rowFilter parameters (live PostgREST schema cache)',
    expectations: 'scripts/lib/sync-schema-contract.mjs',
    checkedTables,
    rows,
};
writeFileSync(path.join(outDir, 'remote-schema-gap.json'), JSON.stringify(evidence, null, 2));
writeFileSync(path.join(outDir, 'remote-schema-gap.md'), [
    `# Remote schema gap audit`,
    '',
    `- Target: ${url}`,
    `- Generated: ${evidence.generatedAt}`,
    `- Method: ${evidence.source}`,
    `- Expectations: ${evidence.expectations} (${checkedTables} synced tables)`,
    '',
    '| local table | remote table | status | pushed cols | missing |',
    '| --- | --- | --- | --- | --- |',
    ...(rows.length
        ? rows.map(r => `| ${r.localTable} | ${r.remoteTable} | ${r.status} | ${r.localColumns} | ${r.missing.join(', ') || '-'} |`)
        : ['| - | - | ok | - | - |']),
    '',
].join('\n'));

console.log(`Target: ${url}`);
console.log(`Synced tables audited: ${checkedTables} - problems: ${rows.length}`);
for (const row of rows) {
    if (row.status === 'missing-remote-table') {
        console.log(`  MISSING TABLE  ${row.localTable} -> ${row.remoteTable}`);
        continue;
    }
    console.log(`  COLUMN GAP     ${row.localTable} -> ${row.remoteTable}: ${row.missing.length} missing`);
    console.log(`                 ${row.missing.join(', ')}`);
}
console.log(`\nEvidence: ${path.join(outDir, 'remote-schema-gap.md')}`);
process.exit(rows.length ? 1 : 0);
