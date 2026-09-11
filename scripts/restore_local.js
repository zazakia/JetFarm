const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../backups/remote_2026-04-01_19-47-21');
const CONNECTION_STRING = 'postgresql://postgres:postgres@localhost:54322/postgres';

const tables = [
    'user_profiles',
    'app_collectors',
    'app_borrowers',
    'app_loans',
    'app_loan_penalties',
    'app_payment_schedules',
    'app_payments',
    'app_expenses',
    'app_cash_transactions',
    'app_bank_accounts',
    'app_bank_transactions',
    'app_collection_logs',
    'app_financial_snapshots',
    'app_remittances',
    'app_savings_transactions',
    'app_expense_categories',
    'collection_groups',
    'app_action_logs'
];

async function restore() {
    const client = new Client({ connectionString: CONNECTION_STRING });
    await client.connect();

    console.log('Connected to local database.');

    try {
        // Disable triggers to avoid foreign key and RLS issues during load
        console.log('Disabling all triggers in public schema...');
        await client.query('SET session_replication_role = "replica";');

        for (const table of tables) {
            const filePath = path.join(BACKUP_DIR, `${table}.json`);
            if (!fs.existsSync(filePath)) {
                console.warn(`Backup file for ${table} not found. Skipping.`);
                continue;
            }

            console.log(`Restoring table: ${table}...`);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            if (!Array.isArray(data) || data.length === 0) {
                console.log(`Table ${table} has no data. Skipping.`);
                continue;
            }

            // Get columns from the first row
            const columns = Object.keys(data[0]);
            const colString = columns.map(c => `"${c}"`).join(', ');

            // Truncate table before insert
            await client.query(`TRUNCATE TABLE public."${table}" CASCADE;`);

            // Batch insert in chunks of 1000
            const CHUNK_SIZE = 1000;
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE);
                console.log(`  Inserting rows ${i + 1} to ${Math.min(i + CHUNK_SIZE, data.length)}...`);

                const valueStrings = [];
                const flatValues = [];
                let paramIndex = 1;

                for (const row of chunk) {
                    const rowPlaceholder = [];
                    for (const col of columns) {
                        let val = row[col];
                        // Handle objects (JSONB/JSON)
                        if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
                            val = JSON.stringify(val);
                        }
                        rowPlaceholder.push(`$${paramIndex++}`);
                        flatValues.push(val);
                    }
                    valueStrings.push(`(${rowPlaceholder.join(', ')})`);
                }

                const query = `INSERT INTO public."${table}" (${colString}) VALUES ${valueStrings.join(', ')}`;
                await client.query(query, flatValues);
            }

            console.log(`Successfully restored ${data.length} rows to ${table}.`);
        }

        // Re-enable triggers
        console.log('Re-enabling triggers...');
        await client.query('SET session_replication_role = "origin";');

        console.log('Restoration complete!');
    } catch (err) {
        console.error('Restoration failed:', err);
    } finally {
        await client.end();
    }
}

restore();
