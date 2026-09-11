#!/usr/bin/env node
/**
 * Verify the WatermelonDB <-> Supabase contract without starting the UI.
 *
 * Safe defaults:
 *   node scripts/verify-sync-integrity.mjs                  # local, read-only
 *   node scripts/verify-sync-integrity.mjs --production     # production, read-only
 *   node scripts/verify-sync-integrity.mjs --canary         # local authenticated write/read/delete
 *
 * Production writes require both --canary and --allow-production-write.
 */

import path from 'path';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from 'fs';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const PRODUCTION = args.includes('--production');
const CANARY = args.includes('--canary');
const ALLOW_PRODUCTION_WRITE = args.includes('--allow-production-write');
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const HELP = args.includes('--help') || args.includes('-h');
const tableFlagIndex = args.indexOf('--table');
const SPECIFIC_TABLE = tableFlagIndex >= 0 ? args[tableFlagIndex + 1] : null;

if (HELP) {
    console.log(`Usage: node scripts/verify-sync-integrity.mjs [options]

Options:
  --production              Target .env.production (default: .env.local)
  --table <local-name>      Check one table from the sync contract
  --canary                  Run authenticated push/pull/soft-delete verification
  --allow-production-write  Required in addition to --canary for production
  --verbose, -v             Print table counts and error details
  --help, -h                Show this help`);
    process.exit(0);
}

if (PRODUCTION && CANARY && !ALLOW_PRODUCTION_WRITE) {
    console.error('Production canary blocked: add --allow-production-write only after reviewing the target.');
    process.exit(2);
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

const root = process.cwd();
// The selected environment always wins over inherited shell variables. This
// prevents a local verification command from accidentally retaining prod URLs.
loadEnvFile(path.join(root, PRODUCTION ? '.env.production' : '.env.local'), true);
loadEnvFile(path.join(root, '.env'), false);

const contractPath = path.join(root, 'src', 'services', 'syncTableContract.json');
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
const allLocalTables = [...contract.coreTables, ...contract.configTables];
const apiOnlyTables = contract.apiOnlyTables ?? [];
const verifierTables = [...allLocalTables, ...apiOnlyTables];
const tableMap = contract.remoteTableMap;
const requiredRemoteColumns = contract.requiredRemoteColumns ?? {};

if (SPECIFIC_TABLE && !verifierTables.includes(SPECIFIC_TABLE)) {
    console.error(`Unknown sync table "${SPECIFIC_TABLE}". Use a local table name from ${contractPath}.`);
    process.exit(2);
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = process.env.EXPO_PUBLIC_E2E_TEST_EMAIL || process.env.E2E_TEST_EMAIL || 'admin@poscursor.com';
const TEST_PASSWORD = process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD || process.env.E2E_TEST_PASSWORD || '12345678';

if (!SUPABASE_URL || !ANON_KEY) {
    console.error(`Missing Supabase URL or anon key in ${PRODUCTION ? '.env.production' : '.env.local'}.`);
    process.exit(2);
}
if (!TEST_EMAIL || !TEST_PASSWORD) {
    console.error('Missing E2E test credentials required to exercise authenticated RLS.');
    process.exit(2);
}

const clientOptions = {
    auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
    },
};
const appClient = createClient(SUPABASE_URL, ANON_KEY, clientOptions);
const serviceClient = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, clientOptions) : null;
const selectedTables = SPECIFIC_TABLE ? [SPECIFIC_TABLE] : verifierTables;
const LOCAL_JWT_SKEW_RETRY_MS = 1200;

let passed = 0;
let failed = 0;
let warned = 0;
const results = [];
const startedAt = new Date();

const ok = message => { passed += 1; console.log(`  PASS ${message}`); };
const fail = message => { failed += 1; console.error(`  FAIL ${message}`); };
const warn = message => { warned += 1; console.warn(`  WARN ${message}`); };
const info = message => { if (VERBOSE) console.log(`       ${message}`); };
const section = title => console.log(`\n== ${title} ==`);

function classifyError(error) {
    const text = [error?.code, error?.message, error?.details, error?.hint]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    if (error?.code === 'PGRST205' || error?.code === 'PGRST204' || error?.code === '42703' || error?.code === '42P01' || text.includes('schema cache') || text.includes('could not find the table') || (text.includes('could not find') && text.includes('column'))) return 'schema';
    if (error?.status === 401 || error?.code === 'PGRST303' || text.includes('invalid jwt') || text.includes('jwt expired') || text.includes('jwt issued at future')) return 'auth';
    if (error?.status === 403 || error?.code === '42501' || text.includes('permission denied') || text.includes('row-level security')) return 'permission';
    if (text.includes('timeout') || text.includes('timed out')) return 'timeout';
    if (text.includes('failed to fetch') || text.includes('network') || text.includes('connection')) return 'network';
    return 'unknown';
}

function errorSummary(error) {
    return [error?.code, error?.message, error?.details, error?.hint]
        .filter(Boolean)
        .join(' - ');
}

async function authenticate() {
    section('Authenticated RLS session');
    const { data, error } = await appClient.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });
    if (error || !data?.user) {
        fail(`Authentication failed (${classifyError(error)}): ${errorSummary(error)}`);
        return null;
    }
    ok(`Authenticated test identity for ${PRODUCTION ? 'production' : 'local'} RLS checks`);
    return data.user;
}

async function checkTable(localTable) {
    const remoteTable = tableMap[localTable] ?? localTable;
    const requiredColumns = ['id', ...(requiredRemoteColumns[localTable] ?? [])];
    try {
        // Use a real bounded GET. A count-only HEAD request can be answered from
        // a stale PostgREST schema cache and falsely report a dropped table as
        // reachable, which is exactly the failure this verifier must detect.
        const queryTable = () => appClient
            .from(remoteTable)
            .select(requiredColumns.join(','), { count: 'exact' })
            .limit(1);
        let response = await queryTable();

        // Local GoTrue and PostgREST containers can disagree with the host clock
        // for a fraction of a second immediately after issuing a token. Retry the
        // idempotent read once after the token's issued-at time has safely passed.
        if (!PRODUCTION && response.error?.code === 'PGRST303') {
            info(`${localTable}: waiting for local JWT clock skew to settle`);
            await new Promise(resolve => setTimeout(resolve, LOCAL_JWT_SKEW_RETRY_MS));
            response = await queryTable();
        }

        const { data, count, error } = response;
        if (error) {
            const kind = classifyError(error);
            fail(`${localTable} -> ${remoteTable}: ${kind} error`);
            info(errorSummary(error));
            const result = { localTable, remoteTable, requiredColumns, status: 'failed', kind, error: errorSummary(error) };
            results.push(result);
            return result;
        }
        const rowCount = count ?? data?.length ?? 0;
        ok(`${localTable} -> ${remoteTable}: reachable through authenticated Data API`);
        if (rowCount === 0) warn(`${localTable} -> ${remoteTable}: table is empty`);
        info(`visible rows: ${rowCount}`);
        const result = { localTable, remoteTable, requiredColumns, status: 'passed', count: rowCount };
        results.push(result);
        return result;
    } catch (error) {
        const kind = classifyError(error);
        fail(`${localTable} -> ${remoteTable}: ${kind} exception`);
        info(errorSummary(error) || String(error));
        const result = { localTable, remoteTable, requiredColumns, status: 'failed', kind, error: errorSummary(error) || String(error) };
        results.push(result);
        return result;
    }
}

async function runCanary(user) {
    if (!CANARY) return { status: 'skipped' };
    section('Authenticated bidirectional canary');
    const id = `sync-integrity-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const now = new Date().toISOString();
    const row = {
        id,
        entity_type: 'sync_integrity_canary',
        entity_id: id,
        action: 'CREATE',
        performed_by: user.id,
        old_data: null,
        new_data: JSON.stringify({ source: 'verify-sync-integrity' }),
        timestamp: now,
        created_at: now,
        updated_at: now,
        deleted_at: null,
    };

    const { error: insertError } = await appClient.from('app_action_logs').insert(row);
    if (insertError) {
        fail(`Canary push failed (${classifyError(insertError)}): ${errorSummary(insertError)}`);
        return { status: 'failed', phase: 'push', error: errorSummary(insertError) };
    }
    ok('Canary pushed with the same authenticated role used by the app');

    const { data: pulled, error: pullError } = await appClient
        .from('app_action_logs')
        .select('id, deleted_at')
        .eq('id', id)
        .single();
    if (pullError || pulled?.id !== id) {
        fail(`Canary pull failed (${classifyError(pullError)}): ${errorSummary(pullError)}`);
        return { status: 'failed', phase: 'pull', id, error: errorSummary(pullError) };
    }
    ok('Canary pulled back through authenticated RLS');

    const deletedAt = new Date().toISOString();
    const { error: deleteError } = await appClient
        .from('app_action_logs')
        .update({ deleted_at: deletedAt, updated_at: deletedAt })
        .eq('id', id);
    if (deleteError) {
        fail(`Canary soft-delete failed (${classifyError(deleteError)}): ${errorSummary(deleteError)}`);
        return { status: 'failed', phase: 'soft-delete', id, error: errorSummary(deleteError) };
    }
    ok('Canary soft-delete pushed successfully');

    const { data: deletedRow, error: verifyDeleteError } = await appClient
        .from('app_action_logs')
        .select('deleted_at')
        .eq('id', id)
        .single();
    if (verifyDeleteError || !deletedRow?.deleted_at) {
        fail(`Canary delete pull failed (${classifyError(verifyDeleteError)}): ${errorSummary(verifyDeleteError)}`);
        return { status: 'failed', phase: 'verify-delete', id, error: errorSummary(verifyDeleteError) };
    }
    ok('Canary soft-delete pulled back successfully');

    if (serviceClient) {
        const { error: cleanupError } = await serviceClient.from('app_action_logs').delete().eq('id', id);
        if (cleanupError) warn(`Canary hard cleanup failed; soft-deleted row ${id} remains`);
        else ok('Canary row permanently cleaned up');
    } else {
        warn(`No service key available; soft-deleted canary row ${id} remains for audit`);
    }
    return { status: 'passed', id };
}

function writeReport(user, canary) {
    const outputDirectory = path.join(root, 'tmp', 'sync-repair');
    mkdirSync(outputDirectory, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(outputDirectory, `sync-integrity-${PRODUCTION ? 'production' : 'local'}-${stamp}.json`);
    writeFileSync(reportPath, JSON.stringify({
        environment: PRODUCTION ? 'production' : 'local',
        targetUrl: SUPABASE_URL,
        mode: CANARY ? 'canary' : 'read-only',
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        authenticatedUserId: user?.id ?? null,
        tableCount: selectedTables.length,
        passed,
        failed,
        warned,
        tables: results,
        canary,
    }, null, 2));
    return reportPath;
}

async function main() {
    console.log(`\nPOSCursor sync integrity verifier`);
    console.log(`Target: ${PRODUCTION ? 'production' : 'local'} (${SUPABASE_URL})`);
    console.log(`Mode: ${CANARY ? 'authenticated canary' : 'read-only'}; tables: ${selectedTables.length}`);

    const user = await authenticate();
    if (!user) {
        const reportPath = writeReport(null, { status: 'skipped' });
        console.error(`Report: ${reportPath}`);
        process.exit(1);
    }

    section('Sync table contract');
    await Promise.all(selectedTables.map(checkTable));
    const canary = await runCanary(user);
    await appClient.auth.signOut();

    const reportPath = writeReport(user, canary);
    section('Summary');
    console.log(`Tables reachable: ${results.filter(result => result.status === 'passed').length}/${selectedTables.length}`);
    console.log(`Checks: ${passed} passed, ${failed} failed, ${warned} warnings`);
    console.log(`Report: ${reportPath}`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
    fail(`Fatal verifier error: ${errorSummary(error) || String(error)}`);
    const reportPath = writeReport(null, { status: 'failed', error: errorSummary(error) || String(error) });
    console.error(`Report: ${reportPath}`);
    process.exit(1);
});
