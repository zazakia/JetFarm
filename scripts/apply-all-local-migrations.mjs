import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const { Client } = pg;

const client = new Client({
  host: process.env.SUPABASE_DB_HOST || '127.0.0.1',
  port: Number(process.env.SUPABASE_DB_PORT || '45422'),
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || process.env.EXPO_PUBLIC_SUPABASE_DB_PASSWORD || 'postgres',
});

async function main() {
  console.log('Connecting to local Postgres...');
  await client.connect();
  console.log('Connected successfully.\n');

  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s) in ${migrationsDir}.\n`);

  let appliedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf8');
    try {
      await client.query(sql);
      appliedCount++;
      console.log(`  [OK] Applied ${file}`);
    } catch (err) {
      // If error is due to already existing objects, log warning and rollback transaction if open
      await client.query('ROLLBACK;').catch(() => {});
      console.log(`  [WARN] ${file}: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\nMigration run complete. Applied: ${appliedCount}, Warnings/Skipped: ${errorCount}`);

  console.log('\nReloading PostgREST schema cache...');
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log('Schema cache reload notified.');

  // Verify sync tables
  console.log('\nVerifying sync tables in public schema...');
  const checkTables = [
    'app_loan_applications',
    'app_guarantors',
    'app_areas',
    'ws_customers',
    'ws_deliveries',
    'ws_containers',
    'ws_payments',
    'ws_expenses'
  ];

  for (const table of checkTables) {
    const res = await client.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [table]);
    const exists = res.rows[0].exists;
    if (exists) {
      console.log(`  [OK] Table public.${table} exists.`);
    } else {
      console.error(`  [FAIL] Table public.${table} is MISSING!`);
    }
  }
}

main()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nFailed:', err);
    process.exit(1);
  });
