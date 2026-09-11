require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_CONNECTION_STRING;

if (!connectionString) {
    console.error("❌ Error: No connection string found. Please set DATABASE_URL or SUPABASE_CONNECTION_STRING in your environment or .env file.");
    process.exit(1);
}

// Get backup directory from command line arguments
const backupDirArg = process.argv[2];
if (!backupDirArg) {
    console.error("❌ Error: Please provide the path to the backup directory.");
    console.log("Usage: node scripts/restore_supabase.js ./backups/remote_TIMESTAMP");
    process.exit(1);
}

const BACKUP_DIR = path.isAbsolute(backupDirArg) ? backupDirArg : path.join(process.cwd(), backupDirArg);

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
    console.log("🚀 Starting remote database restore...");
    console.log(`📂 Source: ${BACKUP_DIR}`);

    const client = new Client({ 
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to database.");

        // Disable triggers to avoid foreign key and RLS issues during load
        console.log('Disabling all triggers (session_replication_role = replica)...');
        await client.query('SET session_replication_role = "replica";');

        for (const table of tables) {
            const filePath = path.join(BACKUP_DIR, `${table}.json`);
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ Backup file for ${table} not found at ${filePath}. Skipping.`);
                continue;
            }

            console.log(`📦 Restoring table: ${table}...`);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            if (!Array.isArray(data) || data.length === 0) {
                console.log(`   - Table ${table} has no data. Skipping.`);
                continue;
            }

            // Get columns from the first row
            const columns = Object.keys(data[0]);
            const colString = columns.map(c => `"${c}"`).join(', ');

            // Truncate table before insert
            console.log(`   - Truncating public."${table}"...`);
            await client.query(`TRUNCATE TABLE public."${table}" CASCADE;`);

            // Batch insert in chunks of 500
            const CHUNK_SIZE = 500;
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE);
                console.log(`   - Inserting rows ${i + 1} to ${Math.min(i + CHUNK_SIZE, data.length)}...`);

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

            console.log(`   ✅ Successfully restored ${data.length} rows to ${table}.`);
        }

        // Re-enable triggers
        console.log('Re-enabling triggers (session_replication_role = origin)...');
        await client.query('SET session_replication_role = "origin";');

        console.log("\n✨ Restoration completed successfully!");
    } catch (error) {
        console.error("❌ Critical error during restoration:", error);
    } finally {
        await client.end();
    }
}

restore().catch(console.error);
