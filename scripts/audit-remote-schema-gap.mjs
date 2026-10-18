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

const contract = JSON.parse(readFileSync(path.join(root, 'src', 'services', 'syncTableContract.json'), 'utf8'));
const tableMap = contract.remoteTableMap ?? {};
const localTables = [...contract.coreTables, ...contract.configTables];
const specificTable = flagValue('--table');
if (specificTable && !localTables.includes(specificTable)) {
    console.error(`Unknown local table "${specificTable}".`);
    process.exit(2);
}

// Every table in src/database/schema.ts is a `tableSchema({ ... })` call; brace
// match each one so a column's own nested arrays can't leak into the block.
const schemaSource = readFileSync(path.join(root, 'src', 'database', 'schema.ts'), 'utf8');
const tableBlocks = new Map();
for (let i = schemaSource.indexOf('tableSchema('); i !== -1; i = schemaSource.indexOf('tableSchema(', i + 1)) {
    let depth = 0;
    let end = -1;
    for (let j = i + 'tableSchema'.length; j < schemaSource.length; j += 1) {
        const ch = schemaSource[j];
        if (ch === '(' || ch === '[' || ch === '{') depth += 1;
        else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
        if (depth === 0) { end = j; break; }
    }
    if (end === -1) continue;
    const block = schemaSource.slice(i, end + 1);
    const name = block.match(/name:\s*'([^']+)'/);
    if (name && !tableBlocks.has(name[1])) tableBlocks.set(name[1], block);
}

function localColumns(localTable) {
    const block = tableBlocks.get(localTable);
    if (!block) return null;
    const columns = new Set();
    for (const match of block.matchAll(/\{\s*name:\s*'([^']+)'\s*,\s*type:/g)) columns.add(match[1]);
    columns.add('id');
    return columns;
}

const response = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
});
if (!response.ok) {
    console.error(`OpenAPI fetch failed: HTTP ${response.status}`);
    process.exit(2);
}
const spec = await response.json();

// A rowFilter parameter exists for every column PostgREST has in its schema cache.
function remoteColumns(remoteTable) {
    const params = spec?.paths?.[`/${remoteTable}`]?.get?.parameters ?? [];
    const cols = new Set();
    for (const param of params) {
        const ref = typeof param === 'string' ? param : param?.$ref ?? '';
        const prefix = `#/parameters/rowFilter.${remoteTable}.`;
        if (ref.startsWith(prefix)) cols.add(ref.slice(prefix.length));
    }
    return cols.size ? cols : null;
}

const rows = [];
for (const localTable of (specificTable ? [specificTable] : localTables)) {
    const remoteTable = tableMap[localTable] ?? localTable;
    const local = localColumns(localTable);
    if (!local) {
        rows.push({ localTable, remoteTable, status: 'unparsed-local-schema' });
        continue;
    }
    const remote = remoteColumns(remoteTable);
    if (!remote) {
        rows.push({ localTable, remoteTable, status: 'missing-remote-table', localColumnCount: local.size });
        continue;
    }
    const missing = [...local].filter(c => !remote.has(c)).sort();
    rows.push({
        localTable,
        remoteTable,
        status: missing.length ? 'column-gap' : 'ok',
        localColumns: local.size,
        remoteColumns: remote.size,
        missing,
    });
}

const outDir = path.resolve(root, flagValue('--out') || path.join('tmp', 'remote-schema-gap'));
mkdirSync(outDir, { recursive: true });
const evidence = {
    generatedAt: new Date().toISOString(),
    target: url,
    source: 'OpenAPI rowFilter parameters (live PostgREST schema cache)',
    rows,
};
writeFileSync(path.join(outDir, 'remote-schema-gap.json'), JSON.stringify(evidence, null, 2));
writeFileSync(path.join(outDir, 'remote-schema-gap.md'), [
    `# Remote schema gap audit`,
    '',
    `- Target: ${url}`,
    `- Generated: ${evidence.generatedAt}`,
    `- Method: ${evidence.source}`,
    '',
    '| local table | remote table | status | local cols | remote cols | missing |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(r => `| ${r.localTable} | ${r.remoteTable} | ${r.status} | ${r.localColumns ?? '-'} | ${r.remoteColumns ?? '-'} | ${(r.missing ?? []).join(', ') || '-'} |`),
    '',
].join('\n'));

const gaps = rows.filter(r => r.status !== 'ok');
console.log(`Target: ${url}`);
console.log(`Tables audited: ${rows.length} - with a gap: ${gaps.length} - clean: ${rows.length - gaps.length}`);
for (const row of gaps) {
    if (row.status === 'missing-remote-table') {
        console.log(`  MISSING TABLE  ${row.localTable} -> ${row.remoteTable}`);
        continue;
    }
    if (row.status !== 'column-gap') continue;
    console.log(`  COLUMN GAP     ${row.localTable} -> ${row.remoteTable}: ${row.missing.length} missing`);
    console.log(`                 ${row.missing.join(', ')}`);
}
console.log(`\nEvidence: ${path.join(outDir, 'remote-schema-gap.md')}`);
process.exit(gaps.length ? 1 : 0);
