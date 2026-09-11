import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { database } from '../src/database/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function clearProdDatabase() {
  console.log('⚠️ Executing production database clearing...');
  
  const transactionalTables = [
    'payments',
    'payment_schedules',
    'loans',
    'savings_transactions',
    'expenses',
    'cash_transactions',
    'bank_transactions',
    'remittances',
    'collection_logs',
    'financial_snapshots',
    'loan_penalties',
    'action_logs',
    'guarantors',
    'loan_applications',
    'borrowers'
  ];

  await database.write(async () => {
    for (const tableName of transactionalTables) {
      try {
        const collection = database.get(tableName);
        const allRecords = await collection.query().fetch();
        for (const record of allRecords) {
          await record.destroyPermanently();
        }
        console.log(`🧹 Cleared ${allRecords.length} records from ${tableName}.`);
      } catch (err) {
        console.warn(`⚠️ Warning clearing ${tableName}: ${err.message}`);
      }
    }
  });

  console.log('✨ Production database reset complete.');
}

clearProdDatabase().catch(console.error);
