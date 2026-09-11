import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(__dirname, '../src/services/syncTableContract.json'), 'utf8'));

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkCounts() {
  console.log('=== Production Database Table Row Counts (YOUR_SUPABASE_PROJECT) ===\n');
  const remoteTables = Array.from(new Set(Object.values(contract.remoteTableMap)));
  
  const existingTables = [];
  const missingTables = [];

  for (const table of remoteTables) {
    const res = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (res.error) {
      if (res.status === 404 || res.error.code === 'PGRST204' || res.error.code === '42P01') {
        missingTables.push(table);
      } else {
        existingTables.push({ table, count: 'Error: ' + res.error.message, status: res.status });
      }
    } else if (res.status === 204) {
      missingTables.push(table);
    } else {
      existingTables.push({ table, count: res.count ?? 0, status: res.status });
    }
  }

  console.log('--- EXISTING TABLES IN PRODUCTION ---');
  let totalRows = 0;
  for (const item of existingTables) {
    console.log(`  ✅ ${item.table.padEnd(32)} : ${item.count} rows`);
    if (typeof item.count === 'number') totalRows += item.count;
  }
  console.log(`\n  Total rows across all existing tables: ${totalRows}\n`);

  console.log('--- MISSING/UNCREATED TABLES IN PRODUCTION ---');
  console.log(`  (${missingTables.length} tables not found in schema): ${missingTables.join(', ')}`);
}

checkCounts().catch(console.error);
