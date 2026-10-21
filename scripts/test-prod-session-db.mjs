import pg from 'pg';
import { pgSslConfig, requireDbPassword } from './lib/pgTls.mjs';

const { Client } = pg;
const projectRef = 'YOUR_SUPABASE_PROJECT';
const password = requireDbPassword();

const client = new Client({
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: `postgres.${projectRef}`,
  password,
  ssl: pgSslConfig(),
  connectionTimeoutMillis: 5000,
});

async function testSession() {
  console.log('Testing session mode (port 5432) on aws-1-ap-southeast-1.pooler.supabase.com...');
  try {
    await client.connect();
    const res = await client.query('SELECT version();');
    console.log('✅ Session mode works! Postgres version:', res.rows[0].version);
    await client.end();
  } catch (err) {
    console.error('❌ Session mode failed:', err.message);
  }
}

testSession();
