import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile('.env.production');
loadEnvFile('.env.local');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.EXPO_PUBLIC_E2E_TEST_EMAIL || 'admin@poscursor.com';
const password = process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD || '12345678';

if (!url || !anonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase = createClient(url, anonKey);

const tables = [
  'user_profiles',
  'app_borrowers',
  'app_loans',
  'app_payments',
  'app_collectors',
  'app_action_logs',
  'app_loan_applications',
  'app_areas',
];

const login = await supabase.auth.signInWithPassword({ email, password });
console.log(`login: ${login.error ? login.error.message : `ok ${login.data.user?.id || ''}`}`);

for (const table of tables) {
  const result = await supabase
    .from(table)
    .select('id', { count: 'exact', head: false })
    .limit(1);
  if (result.error) {
    console.log(`${table}: ERROR ${result.error.code || ''} ${result.error.message}`);
  } else {
    console.log(`${table}: OK rows=${result.data?.length ?? 0} count=${result.count ?? 'n/a'}`);
  }
}

for (const rpcName of ['get_current_role', 'is_global_admin']) {
  const result = await supabase.rpc(rpcName);
  if (result.error) {
    console.log(`${rpcName}: ERROR ${result.error.code || ''} ${result.error.message}`);
  } else {
    console.log(`${rpcName}: ${JSON.stringify(result.data)}`);
  }
}
