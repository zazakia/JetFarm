import { Database } from '@nozbe/watermelondb';
import { addDays, startOfDay, subDays } from 'date-fns';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import Payment from '../../database/models/Payment';
import Remittance from '../../database/models/Remittance';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { useCollectorRemittance } from '../useCollectorRemittance';

const testDatabase = { current: null as Database | null };

jest.mock('../../database', () => ({
    get database() {
        return testDatabase.current;
    },
}));

const COLLECTOR_ID = 'collector-remit';
const NOW = new Date();
const TODAY_NOON = startOfDay(NOW).getTime() + 43_200_000;
const YESTERDAY_NOON = startOfDay(subDays(NOW, 1)).getTime() + 43_200_000;
const LAST_WEEK = startOfDay(subDays(NOW, 7)).getTime();

interface SeedPayment {
    amount: number;
    when: number;
    deleted?: boolean;
}

interface SeedRemittance {
    amount: number;
    when: number;
    status?: string;
    deleted?: boolean;
}

async function seedPayments(rows: SeedPayment[]) {
    await testDatabase.current!.write(async () => {
        for (const row of rows) {
            await testDatabase.current!.get<Payment>('payments').create((p) => {
                p.collectorId = COLLECTOR_ID;
                p.amount = row.amount;
                p.paymentDate = row.when;
                if (row.deleted) p.deletedAt = row.when;
            });
        }
    });
}

async function seedRemittances(rows: SeedRemittance[]) {
    await testDatabase.current!.write(async () => {
        for (const row of rows) {
            await testDatabase.current!.get<Remittance>('remittances').create((r) => {
                r.collectorId = COLLECTOR_ID;
                r.amount = row.amount;
                r.remittanceDate = row.when;
                r.status = row.status || 'approved';
                if (row.deleted) r.deletedAt = row.when;
            });
        }
    });
}

function renderRemittance() {
    return renderHook(() => useCollectorRemittance({ collectorId: COLLECTOR_ID }));
}

async function waitForReady(result: { current: { loading: boolean } }) {
    await waitFor(() => {
        expect(result.current.loading).toBe(false);
    });
}

describe('useCollectorRemittance', () => {
    let db: Database;

    beforeEach(async () => {
        db = createTestDatabase();
        testDatabase.current = db;

        await db.write(async () => {
            for (const table of ['remittances', 'payments']) {
                const existing = await db.get(table).query().fetch();
                for (const row of existing) await row.destroyPermanently();
            }
        });
    });

    afterEach(async () => {
        // Unmount first: Watermelon refuses to reset a database that still has live observers.
        cleanup();
        testDatabase.current = null;
        await closeTestDatabase(db);
    });

    it('splits the daily collection from cash held across all payments', async () => {
        await seedPayments([
            { amount: 1000, when: YESTERDAY_NOON },
            { amount: 500, when: TODAY_NOON },
            { amount: 300, when: TODAY_NOON },
        ]);
        await seedRemittances([{ amount: 1000, when: LAST_WEEK, status: 'approved' }]);

        const { result } = renderRemittance();
        await waitForReady(result);

        expect(result.current.todayCollection).toBe(800);
        // 1800 collected all-time minus 1000 already approved away.
        expect(result.current.balance).toBe(800);
        expect(result.current.suggestedAmount).toBe(800);
    });

    it('suggests the daily collection only while no cash is held', async () => {
        await seedPayments([{ amount: 700, when: TODAY_NOON }]);
        await seedRemittances([{ amount: 700, when: LAST_WEEK, status: 'approved' }]);

        const { result } = renderRemittance();
        await waitForReady(result);

        expect(result.current.balance).toBe(0);
        expect(result.current.suggestedAmount).toBe(700);
    });

    it('ignores soft-deleted payments and remittances', async () => {
        await seedPayments([
            { amount: 400, when: TODAY_NOON },
            { amount: 5000, when: TODAY_NOON, deleted: true },
        ]);
        await seedRemittances([
            { amount: 100, when: LAST_WEEK, status: 'approved' },
            { amount: 4000, when: LAST_WEEK, status: 'approved', deleted: true },
        ]);

        const { result } = renderRemittance();
        await waitForReady(result);

        expect(result.current.todayCollection).toBe(400);
        expect(result.current.balance).toBe(300);
    });

    it('does not deduct pending or rejected remittances from the balance', async () => {
        await seedPayments([{ amount: 900, when: TODAY_NOON }]);
        await seedRemittances([
            { amount: 300, when: LAST_WEEK, status: 'pending' },
            { amount: 200, when: LAST_WEEK, status: 'rejected' },
        ]);

        const { result } = renderRemittance();
        await waitForReady(result);

        expect(result.current.balance).toBe(900);
    });

    it('raises the daily total and the held balance when a payment is recorded, without remounting', async () => {
        await seedPayments([{ amount: 500, when: TODAY_NOON }]);

        const { result } = renderRemittance();
        await waitForReady(result);
        expect(result.current.todayCollection).toBe(500);

        await act(async () => {
            await seedPayments([{ amount: 250, when: TODAY_NOON }]);
        });

        await waitFor(() => {
            expect(result.current.todayCollection).toBe(750);
            expect(result.current.balance).toBe(750);
        });
    });

    it('lowers the balance when a pending remittance gets approved, without remounting', async () => {
        await seedPayments([{ amount: 800, when: TODAY_NOON }]);
        await seedRemittances([{ amount: 600, when: LAST_WEEK, status: 'pending' }]);

        const { result } = renderRemittance();
        await waitForReady(result);
        expect(result.current.balance).toBe(800);

        const pending = (await db.get<Remittance>('remittances').query().fetch())[0];
        await act(async () => {
            await db.write(async () => {
                await pending.update((r) => {
                    r.status = 'approved';
                });
            });
        });

        await waitFor(() => {
            expect(result.current.balance).toBe(200);
        });
    });

    it('keeps the ten most recent remittances, newest first', async () => {
        await seedRemittances(
            Array.from({ length: 12 }, (_, i) => ({
                amount: 100 + i,
                when: startOfDay(addDays(NOW, i)).getTime(),
                status: 'approved',
            })),
        );

        const { result } = renderRemittance();
        await waitForReady(result);

        expect(result.current.remittances).toHaveLength(10);
        expect(result.current.remittances.map((r) => r.amount)).toEqual([
            111, 110, 109, 108, 107, 106, 105, 104, 103, 102,
        ]);
    });

    it('deducts every approved remittance from the balance, not only the ten listed', async () => {
        await seedPayments([{ amount: 10_000, when: TODAY_NOON }]);
        await seedRemittances(
            Array.from({ length: 13 }, (_, i) => ({
                amount: 100,
                when: startOfDay(addDays(NOW, i)).getTime(),
                status: 'approved',
            })),
        );

        const { result } = renderRemittance();
        await waitForReady(result);

        expect(result.current.remittances).toHaveLength(10);
        expect(result.current.balance).toBe(10_000 - 1_300);
    });

    it('reports an empty ledger without a stuck spinner for an unknown collector', async () => {
        await seedPayments([{ amount: 500, when: TODAY_NOON }]);

        const { result } = renderHook(() => useCollectorRemittance({ collectorId: 'nobody' }));
        await waitForReady(result);

        expect(result.current.todayCollection).toBe(0);
        expect(result.current.balance).toBe(0);
        expect(result.current.remittances).toEqual([]);
    });

    it('returns zeros and stops loading when there is no collector yet', async () => {
        const { result } = renderHook(() => useCollectorRemittance({ collectorId: null }));
        await waitForReady(result);

        expect(result.current.balance).toBe(0);
        expect(result.current.remittances).toEqual([]);
    });
});
