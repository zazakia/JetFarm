require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_CONNECTION_STRING;

if (!connectionString) {
    console.error("❌ Error: No connection string found. Please set DATABASE_URL or SUPABASE_CONNECTION_STRING in your environment or .env file.");
    process.exit(1);
}

async function backup() {
    console.log("🚀 Starting remote database backup...");
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'backups', `remote_${timestamp}`);

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const client = new Client({ 
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log("Connected to database.");

        const tablesResult = await client.query(`
            SELECT tablename
            FROM pg_catalog.pg_tables
            WHERE schemaname = 'public';
        `);

        const tables = tablesResult.rows.map(r => r.tablename);
        console.log(`Found ${tables.length} tables in the public schema.`);

        for (const table of tables) {
            console.log(`📦 Backing up table: ${table}...`);
            try {
                // Fetch row count first for reporting
                const countResult = await client.query(`SELECT COUNT(*) FROM public."${table}";`);
                const rowCount = parseInt(countResult.rows[0].count);
                console.log(`   - Row count: ${rowCount}`);

                // Fetch data
                const dataResult = await client.query(`SELECT * FROM public."${table}";`);
                const rows = dataResult.rows;

                const tableFile = path.join(backupDir, `${table}.json`);
                fs.writeFileSync(tableFile, JSON.stringify(rows, null, 2));
                console.log(`   ✅ Saved to ${table}.json (${(fs.statSync(tableFile).size / 1024).toFixed(2)} KB)`);
            } catch (tableError) {
                console.error(`   ❌ Error backing up table ${table}:`, tableError.message);
            }
        }

        console.log("\n✨ Backup completed successfully!");
        console.log(`📂 Location: ${backupDir}`);
    } catch (error) {
        console.error("Critical error during backup:", error);
    } finally {
        await client.end();
    }
}

backup().catch(console.error);

