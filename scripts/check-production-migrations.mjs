import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: 'db.YOUR_SUPABASE_PROJECT.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || process.env.EXPO_PUBLIC_SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const tbl = await client.query(
    `SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_schema='supabase_migrations' AND table_name='schema_migrations')`
  );

  if (!tbl.rows[0].exists) {
    console.log('NO_MIGRATIONS_TABLE');
    process.exit(0);
  }

  const r = await client.query(
    'SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version'
  );
  console.log(JSON.stringify(r.rows, null, 2));
} catch (e) {
  console.warn('⚠️ Warning: Direct production database migration check skipped:', e.message);
  process.exit(0);
} finally {
  await client.end().catch(() => {});
}
