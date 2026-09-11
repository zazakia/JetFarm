/**
 * Legacy production migration helper.
 *
 * This script is intentionally read-only. Schema mutations must use the
 * Supabase CLI migration workflow so changes are recorded in migration history.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/?
/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(path.join(process.cwd(), '.env.production'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY. No credentials are embedded in this script.');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

async function checkTableExists(tableName) {
  const { error } = await supabase.from(tableName).select('id').limit(1);
  if (error?.code === 'PGRST205') return false;
  if (error) throw error;
  return true;
}

console.log('Read-only production schema check');
for (const table of ['user_profiles', 'app_borrowers', 'app_loans', 'cic_settings', 'cic_submissions']) {
  try {
    console.log(`  ${table}: ${await checkTableExists(table) ? 'exists' : 'missing'}`);
  } catch (error) {
    console.log(`  ${table}: error ${error?.code || 'unknown'}`);
  }
}

const migrations = readdirSync(path.join(process.cwd(), 'supabase', 'migrations'))
  .filter(file => file.endsWith('.sql'))
  .sort();
console.log(`Local migration files: ${migrations.length}`);
console.log('Apply pending migrations with: supabase db push --linked');
