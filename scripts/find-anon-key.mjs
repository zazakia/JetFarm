import pg from 'pg';

const { Client } = pg;
const projectRef = 'YOUR_SUPABASE_PROJECT';
const password = process.env.SUPABASE_DB_PASSWORD || process.env.EXPO_PUBLIC_SUPABASE_DB_PASSWORD || 'Qweasd145698@';

const client = new Client({
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: `postgres.${projectRef}`,
  password,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

async function findSecret() {
  await client.connect();

  const res1 = await client.query(`
    SELECT name, setting FROM pg_settings 
    WHERE name LIKE '%pgrst%' OR name LIKE '%jwt%' OR name LIKE '%secret%' OR name LIKE '%supabase%';
  `);
  console.log('pg_settings results:', res1.rows);

  const res2 = await client.query(`
    SELECT * FROM pg_catalog.pg_user WHERE usename IN ('anon', 'authenticator', 'service_role');
  `);
  console.log('pg_user results:', res2.rows);

  await client.end();
}

findSecret().catch(console.error);
