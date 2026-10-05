import { Database, Q } from '@nozbe/watermelondb';
import { endOfDay, startOfDay } from 'date-fns';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import Borrower from '../../database/models/Borrower';
import Loan from '../../database/models/Loan';
import Payment from '../../database/models/Payment';
import PaymentSchedule from '../../database/models/PaymentSchedule';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { useCollectorDashboard } from '../useCollectorDashboard';

const testDatabase = { current: null as Database | null };

jest.mock('../../database', () => ({
    get database() {
        return testDatabase.current;
    },
}));

const COLLECTOR_ID = 'collector-1';

/** Epoch-ms bounds for today, using the same helpers the dashboard uses. */
function todayWindow() {
    const now = new Date();
    const start = startOfDay(now).getTime();
    const end = endOfDay(now).getTime();
    return { start, end, noon: start + 43_200_000, tomorrow: start + 86_400_000 };
}

async function seed() {
    const { noon, tomorrow } = todayWindow();

    await testDatabase.current!.write(async () => {
        const borrower = await testDatabase.current!.get<Borrower>('borrowers').create((b) => {
            b.fullName = 'Reactive Borrower';
            b.collectorId = COLLECTOR_ID;
        });

        await testDatabase.current!.get<Loan>('loans').create((l) => {
            l.borrowerId = borrower.id;
            l.status = 'active';
            l.principalAmount = 5000;
            l.interestAmount = 1000;
            l.totalAmount = 6000;
            l.frequency = 'daily';
            l.installmentAmount = 200;
        });

        await testDatabase.current!.get<Payment>('payments').create((p) => {
            p.collectorId = COLLECTOR_ID;
            p.amount = 1500;
            p.paymentDate = noon;
        });
    });

    const borrower = (await testDatabase.current!.get<Borrower>('borrowers').query().fetch())[0];
    const loan = (await testDatabase.current!.get<Loan>('loans').query().fetch())[0];

    await testDatabase.current!.write(async () => {
        // Unpaid schedule due tomorrow -> counts toward outstanding, not today's goal
        await testDatabase.current!.get<PaymentSchedule>('payment_schedules').create((s) => {
            s.loanId = loan.id;
            s.scheduledAmount = 800;
            s.status = 'pending';
            s.dueDate = tomorrow;
        });
        // Schedule due today of 2000 -> daily goal
        await testDatabase.current!.get<PaymentSchedule>('payment_schedules').create((s) => {
            s.loanId = loan.id;
            s.scheduledAmount = 2000;
            s.status = 'pending';
            s.dueDate = noon;
        });
        // A paid schedule must never count toward outstanding
        await testDatabase.current!.get<PaymentSchedule>('payment_schedules').create((s) => {
            s.loanId = loan.id;
            s.scheduledAmount = 9999;
            s.status = 'paid';
            s.dueDate = noon;
        });
    });

    return { borrower, loan };
}

describe('useCollectorDashboard', () => {
    let db: Database;

    beforeEach(async () => {
        db = createTestDatabase();
        testDatabase.current = db;

        await db.write(async () => {
            for (const table of ['payments', 'payment_schedules', 'loans', 'borrowers']) {
                const rows = await db.get(table).query().fetch();
                for (const row of rows) await row.destroyPermanently();
            }
        });
    });

    afterEach(async () => {
        testDatabase.current = null;
        await closeTestDatabase(db);
    });

    it('derives KPI stats from seeded data', async () => {
        await seed();

        const { result } = renderHook(() => useCollectorDashboard({ collectorId: COLLECTOR_ID }));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.borrowers).toHaveLength(1);
        expect(result.current.stats).toEqual({
            todayCollection: 1500,
            // Outstanding is every unsettled schedule; the daily goal is only those due today.
            outstanding: 2800,
            activeClients: 1,
            efficiency: 75,
            targetToday: 2000,
        });
    });

    it('updates its stats when a payment is recorded, without remounting', async () => {
        await seed();

        const { result } = renderHook(() => useCollectorDashboard({ collectorId: COLLECTOR_ID }));

        await waitFor(() => {
            expect(result.current.stats.todayCollection).toBe(1500);
        });

        await act(async () => {
            await db.write(async () => {
                await db.get<Payment>('payments').create((p) => {
                    p.collectorId = COLLECTOR_ID;
                    p.amount = 500;
                    p.paymentDate = todayWindow().noon;
                });
            });
        });

        await waitFor(() => {
            expect(result.current.stats.todayCollection).toBe(2000);
        });
        expect(result.current.stats.efficiency).toBeCloseTo(100, 5);
    });

    it('updates its stats when a new borrower is assigned, without remounting', async () => {
        const { loan } = await seed();

        const { result } = renderHook(() => useCollectorDashboard({ collectorId: COLLECTOR_ID }));

        await waitFor(() => {
            expect(result.current.stats.activeClients).toBe(1);
        });

        await act(async () => {
            await db.write(async () => {
                await db.get<Borrower>('borrowers').create((b) => {
                    b.fullName = 'Second Borrower';
                    b.collectorId = COLLECTOR_ID;
                });
                await db.get<PaymentSchedule>('payment_schedules').create((s) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 300;
                    s.status = 'pending';
                    s.dueDate = todayWindow().noon;
                });
            });
        });

        await waitFor(() => {
            expect(result.current.borrowers).toHaveLength(2);
        });
        expect(result.current.stats.activeClients).toBe(2);
        expect(result.current.stats.outstanding).toBe(3100);
        expect(result.current.stats.targetToday).toBe(2300);
    });

    it('reports empty stats and no spinner once the collector has no assignments', async () => {
        const { result } = renderHook(() =>
            useCollectorDashboard({ collectorId: 'collector-nobody' }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.borrowers).toEqual([]);
        expect(result.current.stats).toEqual({
            todayCollection: 0,
            outstanding: 0,
            activeClients: 0,
            efficiency: 0,
            targetToday: 0,
        });
    });

    it('hands pull-to-refresh to the caller without refetching through a loader', async () => {
        await seed();

        const onRefresh = jest.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() =>
            useCollectorDashboard({ collectorId: COLLECTOR_ID, onRefresh }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        const paymentsQuery = jest.spyOn(db.get<Payment>('payments'), 'query');
        paymentsQuery.mockClear();

        await act(async () => {
            await result.current.refresh();
        });

        expect(onRefresh).toHaveBeenCalledTimes(1);
        expect(result.current.refreshing).toBe(false);
        expect(paymentsQuery).toHaveBeenCalledTimes(0);
        expect(result.current.stats.todayCollection).toBe(1500);
    });
});
