#!/usr/bin/env node
/**
 * scripts/test-local-sync.mjs
 * ───────────────────────────
 * Diagnostic script: verifies local Docker Supabase can authenticate
 * and that RLS-protected tables are readable with a valid session.
 *
 * Run: node scripts/test-local-sync.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY     = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// Test credentials (seeded by migration 20260402102153)
const TEST_EMAIL    = 'admin@poscursor.com';
const TEST_PASSWORD = '12345678';

const OK  = (s) => `\x1b[32m✅ ${s}\x1b[0m`;
const ERR = (s) => `\x1b[31m❌ ${s}\x1b[0m`;
const INF = (s) => `\x1b[36mℹ️  ${s}\x1b[0m`;
const WRN = (s) => `\x1b[33m⚠️  ${s}\x1b[0m`;

const TABLES = [
  'app_borrowers', 'app_loans', 'app_payments',
  'app_payment_schedules', 'app_expenses', 'app_cash_transactions',
];

async function main() {
  console.log('\n\x1b[1m🔍 POSCursor — Local Sync Diagnostic\x1b[0m');
  console.log(`   Supabase URL : ${SUPABASE_URL}`);
  console.log(`   Anon Key     : ${ANON_KEY.substring(0, 30)}...\n`);

  // ── 1. Health check ──────────────────────────────────────────────────
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log(OK('Local Supabase auth is reachable'));
  } catch (e) {
    console.error(ERR(`Cannot reach local Supabase: ${e.message}`));
    console.error('  → Run: npx supabase start');
    process.exit(1);
  }

  // ── 2. storageKey sanity check ────────────────────────────────────────
  // Mirrors the fixed logic in src/database/supabase.ts
  const projectRef = SUPABASE_URL
    .replace(/^https?:\/\//, '')
    .split('.')[0]
    .split(':')[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  console.log(INF(`Expected localStorage key: "${storageKey}"`));
  if (storageKey.includes('http') || storageKey.includes(':')) {
    console.error(ERR(`Storage key looks wrong ("${storageKey}") — URL parsing bug still present!`));
  } else {
    console.log(OK('Storage key format is correct'));
  }

  // ── 3. Anon query (should return [] due to RLS) ───────────────────────
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });

  const { data: anonData, error: anonErr } = await supabase
    .from('app_borrowers')
    .select('id')
    .limit(1);

  if (anonErr) {
    console.log(WRN(`Anon query error (expected if RLS is strict): ${anonErr.message}`));
  } else {
    console.log(INF(`Anon query returned ${anonData?.length ?? 0} rows (RLS ${anonData?.length === 0 ? 'blocking anon ✓' : 'OPEN — check policies'} )`));
  }

  // ── 4. Login ──────────────────────────────────────────────────────────
  console.log(`\n   Logging in as ${TEST_EMAIL}...`);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authErr || !authData?.session) {
    console.error(ERR(`Login failed: ${authErr?.message ?? 'No session returned'}`));
    console.error('  → Check auth.users seeding (migration 20260402102153_fix_users.sql)');
    process.exit(1);
  }

  console.log(OK(`Login succeeded! User: ${authData.user.email}`));
  console.log(INF(`Access token (first 40 chars): ${authData.session.access_token.substring(0, 40)}...`));

  // ── 5. Authenticated queries ──────────────────────────────────────────
  console.log('\n   Querying tables with authenticated session...');
  let allOk = true;

  for (const table of TABLES) {
    const { data, error, count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: false })
      .limit(0);

    if (error) {
      console.error(ERR(`  ${table}: ${error.message}`));
      allOk = false;
    } else {
      // count is null when head:false + limit 0 — do a real count
      const { count: realCount, error: countErr } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true });
      const n = realCount ?? 0;
      console.log(OK(`  ${table}: ${n} rows`));
    }
  }

  // ── 6. Summary ────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(55));
  if (allOk) {
    console.log(OK('All checks passed — local sync should work!'));
    console.log('\x1b[33m📋 Next step:\x1b[0m');
    console.log('   1. In your browser, open DevTools → Console and run:');
    console.log('      Object.keys(localStorage)');
    console.log('        .filter(k => k.startsWith("sb-"))');
    console.log('        .forEach(k => localStorage.removeItem(k))');
    console.log('   2. Hard-reload the app (Ctrl+Shift+R)');
    console.log('   3. Log in with admin@poscursor.com / 12345678');
    console.log('   4. The sync button should now push/pull data\n');
  } else {
    console.error(ERR('Some checks failed — see errors above'));
  }
}

main().catch(e => {
  console.error(ERR(`Unexpected error: ${e.message}`));
  process.exit(1);
});
