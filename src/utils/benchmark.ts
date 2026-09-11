import { database } from '../database';
import { Q } from '@nozbe/watermelondb';

export async function benchmarkQueries() {
    const results = {};

    const measure = async (name, fn) => {
        const start = performance.now();
        const data = await fn();
        const end = performance.now();
        results[name] = {
            duration: end - start,
            count: data.length
        };
    };

    try {
        await measure('fetchAllBorrowers', () => database.get('borrowers').query().fetch());
        await measure('fetchAllLoans', () => database.get('loans').query().fetch());
        await measure('fetchAllPayments', () => database.get('payments').query().fetch());

        // Test complex query (active loans with borrower info)
        await measure('fetchActiveLoans', () =>
            database.get('loans').query(Q.where('status', 'active')).fetch()
        );

        console.log('--- Performance Benchmark Results ---');
        console.table(results);
        return results;
    } catch (error) {
        console.error('Benchmark failed:', error);
    }
}
