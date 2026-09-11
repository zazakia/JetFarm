/**
 * push-schema-to-production.mjs
 * 
 * Uses the Supabase Management API to run all migration SQL files
 * against the production project via HTTPS (no direct pg TCP needed).
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PROJECT_REF = 'YOUR_SUPABASE_PROJECT';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

if (!ACCESS_TOKEN) {
  console.error('❌ SUPABASE_ACCESS_TOKEN env var is required.');
  console.error('   Get it from: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

async function runQuery(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  return text;
}

async function main() {
  const migrationsDir = join(ROOT, 'supabase', 'migrations');
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  console.log(`🚀 Pushing ${files.length} migrations to production (${PROJECT_REF})...\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    process.stdout.write(`  ${file}... `);
    try {
      await runQuery(sql);
      console.log('✅');
      successCount++;
    } catch (err) {
      const msg = err.message;
      if (
        msg.includes('already exists') ||
        msg.includes('42P07') ||
        msg.includes('42710') ||
        msg.includes('duplicate')
      ) {
        console.log('~ (skipped, already applied)');
        skipCount++;
      } else {
        console.error(`\n  ❌ ${msg.slice(0, 300)}`);
        errorCount++;
        // Continue — don't abort on non-fatal errors
      }
    }
  }

  console.log(`\n--- Done ---`);
  console.log(`✅ Success: ${successCount}, ~ Skipped: ${skipCount}, ❌ Errors: ${errorCount}`);

  if (errorCount === 0) {
    console.log('\n✅ Schema fully applied to production! You can now run:');
    console.log('   node scripts/clear_data.mjs');
    console.log('   node scripts/migrate_poscursor.mjs');
  } else {
    console.log('\n⚠️  Some migrations had errors. Review above output.');
  }
}

main().catch(console.error);
