import pg from 'pg';
import { pgSslConfig, requireDbPassword } from './lib/pgTls.mjs';
import dns from 'dns/promises';

const { Client } = pg;

async function testConnection() {
  let host = 'db.YOUR_SUPABASE_PROJECT.supabase.co';
  try {
    const addrs = await dns.resolve6(host);
    if (addrs && addrs.length > 0) {
      host = addrs[0];
      console.log('Resolved IPv6 address:', host);
    }
  } catch (e) {
    console.log('dns.resolve6 failed, fallback to hardcoded IPv6...');
    host = '2406:da18:1f7e:b101:8506:d757:a22a:d733';
  }

  const client = new Client({
    host,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: requireDbPassword(),
    ssl: pgSslConfig(),
    connectionTimeoutMillis: 5000,
  });

  console.log(`Connecting to Postgres at [${host}]:5432...`);
  try {
    await client.connect();
    const res = await client.query('SELECT version();');
    console.log('✅ Connected successfully! Postgres version:', res.rows[0].version);
    await client.end();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  }
}

testConnection();
