/**
 * push-migrations-to-production.mjs
 * 
 * Concatenates all migration SQL files and sends them to the Supabase
 * Management API (project-level SQL execution). Uses the service role key.
 * 
 * Since the pg direct connection requires IPv6 (not reachable), this script
 * instead uses the Supabase Management REST API endpoint:
 *   POST https://api.supabase.com/v1/projects/{ref}/database/query
 * 
 * The SUPABASE_ACCESS_TOKEN must be provided via env or arg.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

const PROJECT_REF     = 'YOUR_SUPABASE_PROJECT';
const ACCESS_TOKEN    = process.env.SUPABASE_ACCESS_TOKEN || '';

if (!ACCESS_TOKEN) {
  console.error('❌ SUPABASE_ACCESS_TOKEN env var is required.');
  console.error('   Get your token from: https://supabase.com/dashboard/account/tokens');
  console.error('   Then run: $env:SUPABASE_ACCESS_TOKEN="your_token" ; node scripts/push-migrations-to-production.mjs');
  process.exit(1);
}

const migrationsDir = join(ROOT, 'supabase', 'migrations');
const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

async function runQuery(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization:   `Bearer ${ACCESS_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  return text;
}

async function main() {
  console.log(`🚀 Pushing ${files.length} migrations to production (${PROJECT_REF})...\n`);

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    process.stdout.write(`  Running ${file}... `);
    try {
      await runQuery(sql);
      console.log('✅');
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('42P07') || err.message.includes('42710')) {
        console.log('~ (skipped, already exists)');
      } else {
        console.error(`\n  ❌ ${err.message.slice(0, 200)}`);
        // Don't abort — some migrations are cumulative
      }
    }
  }

  console.log('\n✅ All migrations processed.');
}

main().catch(console.error);
