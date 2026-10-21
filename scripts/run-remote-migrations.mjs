import { Client } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Credentials are never hardcoded here: the operator exports the DSN. TLS verification stays on -
// a private CA is supplied through DATABASE_CA rather than by disabling verification.
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
if (!SUPABASE_DB_URL) {
  console.error('SUPABASE_DB_URL is not set. Export the postgres DSN before running this script.');
  process.exit(1);
}

const client = new Client({
  connectionString: SUPABASE_DB_URL,
  ssl: process.env.DATABASE_CA
    ? { rejectUnauthorized: true, ca: readFileSync(process.env.DATABASE_CA, 'utf8') }
    : { rejectUnauthorized: true },
});

await client.connect();
console.log('Connected to remote Supabase DB');

// Run migrations in order
const migrationsDir = join(ROOT, 'supabase', 'migrations');
const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  console.log(`Running migration: ${file}`);
  try {
    await client.query(sql);
    console.log(`  ✓ ${file}`);
  } catch (err) {
    // Skip "already exists" errors — idempotent re-run
    if (err.code === '42P07' || err.code === '42710' || err.message.includes('already exists')) {
      console.log(`  ~ ${file} (skipped: already exists)`);
    } else {
      console.error(`  ✗ ${file}: ${err.message}`);
      throw err;
    }
  }
}

// Run seed
console.log('\nRunning seed.sql...');
const seed = readFileSync(join(ROOT, 'supabase', 'seed.sql'), 'utf8');
try {
  await client.query(seed);
  console.log('  ✓ seed.sql');
} catch (err) {
  console.error(`  ✗ seed.sql: ${err.message}`);
  // Don't throw — seed may fail on duplicate users in production
}

await client.end();
console.log('\nDone.');
