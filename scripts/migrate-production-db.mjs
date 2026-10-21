/**
 * migrate-production-db.mjs
 * 
 * Applies pending migrations in `supabase/migrations/` to the production Supabase database
 * (jetfarm-placeholder-db) using the verified Supavisor session-mode pooler host.
 * Also verifies schema integrity after migration and updates supabase_migrations.schema_migrations.
 */

import pg from 'pg';
import { pgSslConfig, requireDbPassword } from './lib/pgTls.mjs';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load .env.production if present
if (existsSync(join(ROOT, '.env.production'))) {
  const envContent = readFileSync(join(ROOT, '.env.production'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  }
}

const { Client } = pg;
const projectRef = 'jetfarm-placeholder-db';
const password = requireDbPassword();

const client = new Client({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: `postgres.${projectRef}`,
  password,
  ssl: pgSslConfig(),
  connectionTimeoutMillis: 10000,
});

async function migrate() {
  console.log(`🚀 Connecting to production DB (${projectRef}) via Supavisor pooler...`);
  await client.connect();
  console.log(`✅ Connected successfully!\n`);

  // 1. Fetch applied migration versions from schema_migrations
  const hasMigrationsTable = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
    ) as exists;
  `);

  const appliedVersions = new Set();
  if (hasMigrationsTable.rows[0].exists) {
    const existing = await client.query('SELECT version FROM supabase_migrations.schema_migrations;');
    for (const r of existing.rows) {
      appliedVersions.add(r.version);
    }
  }

  const migrationsDir = join(ROOT, 'supabase', 'migrations');
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  console.log(`=== Inspecting ${files.length} Migration Files against Production ===`);
  console.log(`Already registered in schema_migrations: ${appliedVersions.size}\n`);

  let appliedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    // Parse version and name: e.g. "20260910120000_user_profiles_branch_area.sql"
    const match = file.match(/^([0-9_]+)(?:_(.+))?\.sql$/);
    const version = match ? match[1].replace(/_$/, '') : file.replace('.sql', '');
    const name = match && match[2] ? match[2] : file.replace('.sql', '');

    if (appliedVersions.has(version)) {
      console.log(`  - ${file.padEnd(65)} ~ Already tracked`);
      skippedCount++;
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    process.stdout.write(`  - ${file.padEnd(65)} ... `);

    try {
      await client.query(sql);
      
      // Record into schema_migrations if table exists
      if (hasMigrationsTable.rows[0].exists) {
        await client.query(
          `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING;`,
          [version, name]
        );
      }

      console.log('✅ Applied & Recorded');
      appliedCount++;
    } catch (err) {
      const msg = err.message || '';
      const code = err.code || '';
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate') ||
        code === '42P07' || // table already exists
        code === '42710' || // duplicate object
        code === '42P16' || // multiple primary keys
        code === '42701'    // column already exists
      ) {
        // Record as tracked since it already exists
        if (hasMigrationsTable.rows[0].exists) {
          await client.query(
            `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING;`,
            [version, name]
          ).catch(() => {});
        }
        console.log(`~ Skipped (${code || 'already exists'})`);
        skippedCount++;
      } else {
        console.log(`⚠️ Warning: [${code}] ${msg.slice(0, 120)}`);
        errorCount++;
      }
    }
  }

  console.log(`\n=== Migration Execution Summary ===`);
  console.log(`✅ Newly Applied : ${appliedCount}`);
  console.log(`~  Already Exist : ${skippedCount}`);
  console.log(`⚠️  Warnings      : ${errorCount}\n`);

  console.log(`=== Verifying Production Schema Integrity ===`);
  const contract = JSON.parse(readFileSync(join(ROOT, 'src/services/syncTableContract.json'), 'utf8'));
  const remoteTables = Array.from(new Set(Object.values(contract.remoteTableMap))).sort();

  let presentCount = 0;
  const missingTables = [];

  for (const table of remoteTables) {
    const res = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      );`,
      [table]
    );
    if (res.rows[0].exists) {
      presentCount++;
    } else {
      missingTables.push(table);
    }
  }

  console.log(`  Public Schema Tables : ${presentCount} / ${remoteTables.length} contract tables present.`);
  if (missingTables.length === 0) {
    console.log(`  ✅ 100% of contract tables exist in the production database!`);
  } else {
    console.log(`  ⚠️ Missing tables (${missingTables.length}):`, missingTables.join(', '));
  }

  // Verify critical columns
  const colChecks = [
    { table: 'user_profiles', column: 'branch_id' },
    { table: 'user_profiles', column: 'area_id' },
    { table: 'business_units', column: 'branch_id' },
    { table: 'stock_movements', column: 'warehouse_id' },
    { table: 'stock_movements', column: 'branch_id' },
    { table: 'app_cash_transactions', column: 'branch_id' },
    { table: 'app_cash_transactions', column: 'pos_session_id' },
  ];

  console.log(`\n=== Verifying Critical Columns ===`);
  for (const { table, column } of colChecks) {
    const res = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
      );`,
      [table, column]
    );
    console.log(`  ${table}.${column}: ${res.rows[0].exists ? '✅ Present' : '❌ MISSING'}`);
  }

  // Check seed branches
  const branches = await client.query('SELECT count(*) as count FROM public.branches;');
  const warehouses = await client.query('SELECT count(*) as count FROM public.warehouses;');
  console.log(`\n=== Enterprise Structure Counts ===`);
  console.log(`  Branches count   : ${branches.rows[0].count}`);
  console.log(`  Warehouses count : ${warehouses.rows[0].count}`);

  await client.end();

  // Test REST API via Supabase JS Client
  console.log(`\n=== Testing Supabase Client REST API Round-Trip ===`);
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || `https://${projectRef}.supabase.co`;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (secretKey) {
    const supabase = createClient(supabaseUrl, secretKey);
    const apiTestTables = ['branches', 'warehouses', 'user_branch_roles', 'sales_returns', 'sales_return_lines', 'pos_sessions'];
    for (const t of apiTestTables) {
      const { data, error } = await supabase.from(t).select('*').limit(1);
      if (error) {
        console.log(`  API Query [${t}]: ❌ ${error.code} ${error.message}`);
      } else {
        console.log(`  API Query [${t}]: ✅ Success (records: ${data.length})`);
      }
    }
  }

  console.log('\n🎉 Production database migration & verification complete!');
}

migrate().catch(async (err) => {
  console.error('❌ Fatal error during migration:', err);
  await client.end().catch(() => {});
  process.exit(1);
});
