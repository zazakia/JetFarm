import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const STAGING_PROJECT_REF = 'zsrglwrscdxtyxyyyhwd';
const PRODUCTION_PROJECT_REF = 'tigydhnptczbhvqwhiyh';

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_fc2ed3e3beb309d57558f83aebefed0d103b1b09';

// Safety Guard: NEVER allow running against production
if (STAGING_PROJECT_REF === PRODUCTION_PROJECT_REF) {
  console.error('CRITICAL SAFETY VIOLATION: Target project is production!');
  process.exit(1);
}

const migrationsDir = join(ROOT, 'supabase', 'migrations');
const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

async function runQuery(sql, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${STAGING_PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
        signal: controller.signal,
      }
    );
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`Starting staging schema migration on project: ${STAGING_PROJECT_REF}`);
  console.log(`Found ${files.length} migration file(s) in supabase/migrations\n`);

  let applied = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    process.stdout.write(`  [Migration] ${file}... `);

    try {
      await runQuery(sql);
      console.log('Applied');
      applied++;
    } catch (err) {
      const msg = err.message || '';
      if (
        msg.includes('already exists') ||
        msg.includes('42P07') ||
        msg.includes('42710') ||
        msg.includes('42701') ||
        msg.includes('42P16')
      ) {
        console.log('~ Skipped (already exists)');
        skipped++;
      } else {
        console.log(`Error: ${msg.slice(0, 200)}`);
        errors++;
      }
    }
  }

  console.log(`\nMigration summary: ${applied} applied, ${skipped} skipped, ${errors} warnings/errors.\n`);

  console.log('Applying supabase/seed.sql for staging test/quick-login users...');
  try {
    const seedSql = readFileSync(join(ROOT, 'supabase', 'seed.sql'), 'utf8');
    await runQuery(seedSql);
    console.log('Staging seed.sql applied successfully.');
  } catch (err) {
    console.warn('seed.sql warning:', err.message);
  }

  console.log('\nReloading PostgREST schema cache...');
  try {
    await runQuery("NOTIFY pgrst, 'reload schema';");
    console.log('PostgREST notified.');
  } catch (e) {
    console.warn('Reload schema notify warning:', e.message);
  }

  console.log('\nVerifying core staging tables...');
  try {
    const checkResult = await runQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
    const tables = JSON.parse(checkResult).map(r => r.table_name);
    console.log(`Verified ${tables.length} public tables created on staging:`);
    console.log(`Sample tables: ${tables.slice(0, 10).join(', ')}...`);
  } catch (e) {
    console.error('Failed to verify tables:', e.message);
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
