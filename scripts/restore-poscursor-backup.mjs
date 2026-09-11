import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BACKUP_FILE = path.join(__dirname, '../infinity_backup_2026-04-07.json');
const CONNECTION_STRING = 'postgresql://postgres:postgres@localhost:54322/postgres';

const TABLE_MAPPING = {
  'user_profiles': 'user_profiles',
  'collectors': 'app_collectors',
  'borrowers': 'app_borrowers',
  'loans': 'app_loans',
  'payment_schedules': 'app_payment_schedules',
  'payments': 'app_payments',
  'loan_penalties': 'app_loan_penalties',
  'expenses': 'app_expenses',
  'cash_transactions': 'app_cash_transactions',
  'bank_accounts': 'app_bank_accounts',
  'bank_transactions': 'app_bank_transactions',
  'collection_logs': 'app_collection_logs',
  'financial_snapshots': 'app_financial_snapshots',
  'remittances': 'app_remittances',
  'savings_transactions': 'app_savings_transactions',
  'expense_categories': 'app_expense_categories'
};

async function restore() {
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`Error: Backup file not found at ${BACKUP_FILE}`);
    process.exit(1);
  }

  console.log('Reading backup file...');
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  const backupData = backup.data;

  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();

  console.log('Connected to local database.');

  try {
    // Disable triggers and RLS check during load
    console.log('Disabling all triggers and RLS (session_replication_role = replica)...');
    await client.query('SET session_replication_role = "replica";');

    // Restore tables in order to handle potential FK constraints (though replica mode helps)
    // We reverse the list for deletion and follow a logical order for insertion if possible, 
    // but TRUNCATE CASCADE handles it.
    
    // Deleting data first
    console.log('Clearing existing data...');
    const tablesToClear = Object.values(TABLE_MAPPING);
    await client.query(`TRUNCATE TABLE ${tablesToClear.map(t => `public."${t}"`).join(', ')} CASCADE;`);

    for (const [backupKey, tableName] of Object.entries(TABLE_MAPPING)) {
      const data = backupData[backupKey];
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log(`Skipping ${tableName} (no data).`);
        continue;
      }

      console.log(`Restoring ${data.length} rows to ${tableName}...`);

      // 1. Fetch column metadata to identify timestamp columns
      const colMetaRes = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${tableName}'
      `);
      const existingCols = new Set(colMetaRes.rows.map(r => r.column_name));
      const timestampCols = new Set(
        colMetaRes.rows
          .filter(r => r.data_type.includes('timestamp'))
          .map(r => r.column_name)
      );

      // 2. Prepare data (cleanup WatermelonDB fields and format timestamps)
      const sanitizedData = data.map(row => {
        const newRow = {};
        // Only include columns that exist in the DB
        for (const col of Object.keys(row)) {
          if (existingCols.has(col)) {
            newRow[col] = row[col];
          }
        }

        // Convert numeric timestamps to ISO strings for PG
        for (const col of Object.keys(newRow)) {
          if (timestampCols.has(col) && typeof newRow[col] === 'number') {
            newRow[col] = new Date(newRow[col]).toISOString();
          }
        }
        return newRow;
      });

      if (Object.keys(sanitizedData[0]).length === 0) {
        console.log(`Skipping ${tableName} (no matching columns).`);
        continue;
      }

      // 3. Batch insert
      const columns = Object.keys(sanitizedData[0]);
      const colString = columns.map(c => `"${c}"`).join(', ');

      const CHUNK_SIZE = 500;
      for (let i = 0; i < sanitizedData.length; i += CHUNK_SIZE) {
        const chunk = sanitizedData.slice(i, i + CHUNK_SIZE);
        console.log(`  ${tableName}: rows ${i + 1} to ${Math.min(i + CHUNK_SIZE, sanitizedData.length)}...`);

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

        const query = `INSERT INTO public."${tableName}" (${colString}) VALUES ${valueStrings.join(', ')}`;
        await client.query(query, flatValues);
      }
      console.log(`Done restoring ${tableName}.`);
    }

    // Re-enable triggers
    console.log('Re-enabling triggers (session_replication_role = origin)...');
    await client.query('SET session_replication_role = "origin";');
    console.log('Restoration complete!');

  } catch (err) {
    console.error('Restoration failed:', err);
    // Attempt rescue
    try { await client.query('SET session_replication_role = "origin";'); } catch(e){}
  } finally {
    await client.end();
  }
}

restore();
