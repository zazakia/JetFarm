import pg from 'pg';
import { readFileSync } from 'fs';
import path from 'path';

const { Client } = pg;

const client = new Client({
  host: '127.0.0.1',
  port: 45422,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
});

async function main() {
  console.log('Connecting to local Postgres...');
  await client.connect();
  console.log('Connected.');

  // 1. Run migration SQL
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260709040000_add_is_petty_cash_to_cash_transactions.sql');
  console.log(`Reading migration from ${migrationPath}...`);
  const sql = readFileSync(migrationPath, 'utf8');

  console.log('Applying migration SQL...');
  await client.query(sql);
  console.log('Migration SQL applied successfully.');

  // 2. Reload PostgREST schema cache
  console.log('Reloading PostgREST schema cache...');
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log('Schema cache reload notified.');

}

main()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
