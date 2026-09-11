import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { database } from '../src/database/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBackup() {
  console.log('🚀 Executing database backup...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `prod_backup_${timestamp}.json`);
  const tables = [
    'borrowers',
    'loans',
    'payment_schedules',
    'payments',
    'expenses',
    'cash_transactions',
    'bank_accounts',
    'bank_transactions',
    'collection_logs',
    'financial_snapshots',
    'remittances',
    'savings_transactions',
    'expense_categories',
    'collectors',
    'loan_penalties',
    'collection_groups',
    'action_logs',
    'loan_applications',
    'guarantors',
    'areas',
    'employees',
    'payrolls',
  ];

  const backupData = {};
  for (const tableName of tables) {
    try {
      const records = await database.get(tableName).query().fetch();
      backupData[tableName] = records.map(r => r._raw);
      console.log(`📦 Table ${tableName}: ${records.length} records backed up.`);
    } catch (err) {
      console.warn(`⚠️ Could not back up table ${tableName}: ${err.message}`);
      backupData[tableName] = [];
    }
  }

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
  console.log(`✅ Backup successfully created at: ${backupFile}`);
}

runBackup().catch(console.error);
