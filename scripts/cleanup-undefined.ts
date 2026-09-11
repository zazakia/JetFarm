// Mock react-native Platform for Node environment
(global as any).Platform = { OS: 'node' };

import { database } from '../src/database/index';
import Borrower from '../src/database/models/Borrower';
import Loan from '../src/database/models/Loan';
import Payment from '../src/database/models/Payment';
import PaymentSchedule from '../src/database/models/PaymentSchedule';
import { Q } from '@nozbe/watermelondb';

async function cleanupUndefined() {
    console.log("Starting cleanup of 'undefined' borrower data...");

    try {
        const borrowers = await database.collections.get<Borrower>('borrowers')
            .query(Q.where('full_name', 'undefined'))
            .fetch();

        if (borrowers.length === 0) {
            console.log("No borrower named 'undefined' found. Cleanup skipped.");
            return;
        }

        console.log(`Found ${borrowers.length} 'undefined' borrower entries.`);

        await database.write(async () => {
            for (const borrower of borrowers) {
                console.log(`Cleaning up data for borrower ID: ${borrower.id}`);

                // Find all loans for this borrower
                const loans = await database.collections.get<Loan>('loans')
                    .query(Q.where('borrower_id', borrower.id))
                    .fetch();

                for (const loan of loans) {
                    console.log(`  Deleting loan: ${loan.id}`);

                    // Find all schedules for this loan
                    const schedules = await database.collections.get<PaymentSchedule>('payment_schedules')
                        .query(Q.where('loan_id', loan.id))
                        .fetch();
                    
                    // Find all payments for this loan
                    const payments = await database.collections.get<Payment>('payments')
                        .query(Q.where('loan_id', loan.id))
                        .fetch();

                    // Prepare for deletion
                    const toDelete = [
                        ...schedules.map(s => s.prepareMarkAsDeleted()),
                        ...payments.map(p => p.prepareMarkAsDeleted()),
                        loan.prepareMarkAsDeleted()
                    ];

                    await database.batch(...toDelete);
                }

                // Finally delete the borrower
                await borrower.markAsDeleted();
                console.log(`  Deleted borrower: ${borrower.id}`);
            }
        });

        console.log("Cleanup completed successfully.");
    } catch (error) {
        console.error("Error during cleanup:", error);
    }
}

cleanupUndefined().catch(console.error);
