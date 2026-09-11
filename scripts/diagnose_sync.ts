import { SyncService } from '../src/services/SyncService';
import { database } from '../src/database';
import { Q } from '@nozbe/watermelondb';

async function diagnose() {
    console.log('--- Sync Diagnosis Starting ---');
    const pendingCount = await SyncService.updatePendingCount();
    console.log(`Pending local changes (Global): ${pendingCount}`);

    const tables = [
        'borrowers',
        'loans',
        'payments',
        'remittances',
        'user_profiles',
        'collectors',
        'loan_penalties',
        'expenses',
        'cash_transactions',
        'bank_accounts',
        'bank_transactions',
        'collection_logs',
        'financial_snapshots',
        'savings_transactions',
        'expense_categories'
    ];

    for (const table of tables) {
        try {
            const collection = database.get(table);
            const total = await collection.query().fetchCount();
            const created = await collection.query(Q.where('_status', 'created')).fetchCount();
            const updated = await collection.query(Q.where('_status', 'updated')).fetchCount();
            const deleted = await collection.query(Q.where('_status', 'deleted')).fetchCount();

            if (created > 0 || updated > 0 || deleted > 0) {
                console.log(`Table: ${table}`);
                console.log(`  Total: ${total}`);
                console.log(`  To Create: ${created}`);
                console.log(`  To Update: ${updated}`);
                console.log(`  To Delete: ${deleted}`);
            }
        } catch (e) {
            console.error(`Error checking table ${table}:`, e);
        }
    }
    console.log('--- Sync Diagnosis Complete ---');
}

// To run this script, you can use: npx ts-node scripts/diagnose_sync.ts
// Or call it from within the app for debugging.
// diagnose();
