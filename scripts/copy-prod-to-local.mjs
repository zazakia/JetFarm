import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(__dirname, '../src/services/syncTableContract.json'), 'utf8'));

// Production Supabase Credentials
const PROD_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const PROD_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

// Local DB Connection
const LOCAL_PG_URI = 'postgresql://postgres:postgres@127.0.0.1:45422/postgres';

const prodClient = createClient(PROD_URL, PROD_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function copyProdToLocal() {
  console.log('=== Copying Production Data (YOUR_SUPABASE_PROJECT) to Local Database ===\n');

  const remoteTables = Array.from(new Set(Object.values(contract.remoteTableMap)));
  const pgClient = new Client({ connectionString: LOCAL_PG_URI });

  await pgClient.connect();
  console.log('Connected to Local PostgreSQL database (port 45422).');

  try {
    console.log('Temporarily setting session_replication_role = replica (bypassing FK constraints & triggers)...');
    await pgClient.query("SET session_replication_role = 'replica';");

    let totalFetched = 0;
    let totalTablesCopied = 0;

    for (const table of remoteTables) {
      // Paginate to fetch all rows from production table
      let allRows = [];
      let from = 0;
      const step = 1000;

      while (true) {
        const { data, error } = await prodClient
          .from(table)
          .select('*')
          .range(from, from + step - 1);

        if (error) {
          if (error.code !== 'PGRST204' && error.code !== '42P01') {
            console.error(`  ⚠️ Error reading ${table} from prod: ${error.message}`);
          }
          break;
        }

        if (!data || data.length === 0) break;
        allRows = allRows.concat(data);
        if (data.length < step) break;
        from += step;
      }

      if (allRows.length === 0) {
        continue;
      }

      console.log(`  📥 [${table}] Fetched ${allRows.length} rows from production...`);
      totalFetched += allRows.length;
      totalTablesCopied++;

      // Check local table columns from information_schema
      const colRes = await pgClient.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [table]);
      const localCols = new Set(colRes.rows.map(r => r.column_name));

      // Batch insert into local database filtering to columns existing in local table
      const columns = Object.keys(allRows[0]).filter(c => localCols.has(c));
      const colString = columns.map(c => `"${c}"`).join(', ');
      const CHUNK_SIZE = 500;

      for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
        const chunk = allRows.slice(i, i + CHUNK_SIZE);
        const valueStrings = [];
        const flatValues = [];
        let paramIndex = 1;

        for (const row of chunk) {
          const rowPlaceholder = [];
          for (const col of columns) {
            let val = row[col];
            if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
              val = JSON.stringify(val);
            }
            rowPlaceholder.push(`$${paramIndex++}`);
            flatValues.push(val);
          }
          valueStrings.push(`(${rowPlaceholder.join(', ')})`);
        }

        const query = `INSERT INTO public."${table}" (${colString}) VALUES ${valueStrings.join(', ')} ON CONFLICT DO NOTHING;`;
        try {
          await pgClient.query(query, flatValues);
        } catch (insertErr) {
          console.error(`     ❌ Error inserting chunk into ${table}:`, insertErr.message);
        }
      }
    }

    console.log('\nRestoring session_replication_role = origin...');
    await pgClient.query("SET session_replication_role = 'origin';");

    console.log(`\n✨ Copy Complete! Copied data from ${totalTablesCopied} tables (total ${totalFetched} rows processed).`);
  } catch (err) {
    console.error('Fatal error during copy:', err);
  } finally {
    await pgClient.end();
  }
}

copyProdToLocal().catch(console.error);
