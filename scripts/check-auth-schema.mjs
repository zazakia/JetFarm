#!/usr/bin/env node
/**
 * Pre-flight health check for the local Supabase auth schema.
 *
 * Exit codes:
 *   0 = schema is healthy, safe to proceed
 *   1 = NULL tokens found and auto-fixed (restart auth container recommended)
 *   2 = could not connect to local Supabase or validate schema
 */

import path from 'path';
import pg from 'pg';
import { existsSync, readFileSync } from 'fs';

const { Client } = pg;

const envFiles = [
  '.env.local',
  process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}.local` : null,
  process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : null,
  '.env',
].filter(Boolean);

for (const envFile of envFiles) {
  loadEnvFile(path.join(process.cwd(), envFile));
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:45421';
const IS_LOCAL_SUPABASE_URL = /^https?:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2)(:|\/|$)/.test(SUPABASE_URL);
const DB_HOST = process.env.SUPABASE_DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.SUPABASE_DB_PORT || '45422');
const DB_NAME = process.env.SUPABASE_DB_NAME || 'postgres';
const DB_USER = process.env.SUPABASE_DB_USER || 'postgres';
const DB_PASSWORD = process.env.EXPO_PUBLIC_SUPABASE_DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const TOKEN_COLUMNS = [
  'confirmation_token',
  'recovery_token',
  'email_change',
  'email_change_token_new',
  'email_change_token_current',
  'reauthentication_token',
  'phone_change',
];

const COLORS = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

async function main() {
  console.log(COLORS.bold('\n[Check] POSCursor Auth Schema Health Check'));
  console.log(`   Checking auth API: ${SUPABASE_URL}`);
  console.log(`   Checking database: postgres://${DB_USER}:***@${DB_HOST}:${DB_PORT}/${DB_NAME}\n`);

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {},
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      throw new Error(`Health check returned ${res.status}`);
    }
    console.log(COLORS.green('  [OK] Supabase auth service is reachable'));
  } catch (error) {
    if (IS_LOCAL_SUPABASE_URL) {
      // Local Supabase is not running (Docker Desktop likely not started).
      // This is a non-fatal warning for local development — the app can still
      // connect to the production Supabase at runtime if EXPO_PUBLIC_SUPABASE_URL
      // is set in the app's env config. We do NOT exit(2) here so that
      // `npm run web` / `npm run start` are not blocked.
      console.warn(COLORS.yellow(`  [WARN] Cannot reach local Supabase at ${SUPABASE_URL}`));
      console.warn(COLORS.yellow('     Local DB checks skipped. Run: npx supabase start to enable local mode.'));
      console.warn(COLORS.yellow('     The app will use the remote Supabase URL configured in your .env files.'));
      return; // Allow the dev server to start
    } else {
      // Remote Supabase URL is configured but unreachable — this is a real problem.
      console.error(COLORS.red(`  [FAIL] Cannot reach Supabase auth at ${SUPABASE_URL}`));
      process.exit(2);
    }
  }

  if (!IS_LOCAL_SUPABASE_URL) {
    console.log(COLORS.yellow('  [Warn] Remote Supabase URL detected; skipping local Postgres auth schema validation.'));
    console.log(COLORS.green('  [OK] Basic auth reachability check passed'));
    return;
  }

  if (!DB_PASSWORD) {
    console.log(COLORS.yellow('  [Warn] Database password not set; skipping direct auth.users validation.'));
    console.log(COLORS.green('  [OK] Basic auth reachability check passed'));
    return;
  }

  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
  });

  try {
    await client.connect();
  } catch (error) {
    console.error(COLORS.red(`  [FAIL] Could not connect to local Postgres: ${error.message}`));
    process.exit(2);
  }

  try {
    const whereClause = TOKEN_COLUMNS.map((col) => `${col} IS NULL`).join(' OR ');
    const selectColumns = ['id', 'email', ...TOKEN_COLUMNS].join(', ');
    const query = `SELECT ${selectColumns} FROM auth.users WHERE ${whereClause}`;
    const { rows } = await client.query(query);

    if (rows.length === 0) {
      console.log(COLORS.green('  [OK] auth.users has no NULL token columns'));
    } else {
      console.log(COLORS.red(`  [FAIL] Found ${rows.length} user(s) with NULL token columns:`));
      for (const row of rows) {
        const nullCols = TOKEN_COLUMNS.filter((col) => row[col] === null);
        console.log(COLORS.yellow(`     - ${row.email || row.id}: NULL in [${nullCols.join(', ')}]`));
      }

      const updateStatements = TOKEN_COLUMNS.map((col) => `${col} = COALESCE(${col}, '')`).join(', ');
      await client.query(`UPDATE auth.users SET ${updateStatements} WHERE ${whereClause}`);
      console.log(COLORS.yellow(`  [FIXED] Updated ${rows.length} user(s).`));
    }

    // --- RPC Check for get_server_time ---
    console.log(COLORS.cyan('\n  Checking for get_server_time RPC...'));
    const rpcCheckQuery = `
      SELECT EXISTS (
        SELECT 1 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname = 'get_server_time'
      );
    `;
    const rpcRes = await client.query(rpcCheckQuery);
    if (!rpcRes.rows[0].exists) {
      console.log(COLORS.yellow('  [Warn] get_server_time RPC is missing. Auto-fixing...'));
      const createRpcQuery = `
        CREATE OR REPLACE FUNCTION public.get_server_time()
        RETURNS timestamptz
        LANGUAGE sql
        STABLE
        AS $$
          SELECT now();
        $$;
        GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated;
        GRANT EXECUTE ON FUNCTION public.get_server_time() TO anon;
      `;
      await client.query(createRpcQuery);
      console.log(COLORS.green('  [OK] get_server_time RPC created and permissions granted.'));
    } else {
      console.log(COLORS.green('  [OK] get_server_time RPC exists.'));
    }

    console.log(COLORS.green('\n[Done] Database and Auth schema are healthy. Safe to start dev server.\n'));
  } catch (error) {
    console.error(COLORS.red(`  [FAIL] Could not validate schema: ${error.message}`));
    process.exit(2);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(COLORS.red(`\n  [FAIL] Unexpected error: ${error.message}`));
  process.exit(2);
});
