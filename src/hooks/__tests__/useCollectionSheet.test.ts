import { Database } from '@nozbe/watermelondb';
import { addDays, startOfDay, subDays } from 'date-fns';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import Borrower from '../../database/models/Borrower';
import Loan from '../../database/models/Loan';
import PaymentSchedule from '../../database/models/PaymentSchedule';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { useCollectionSheet } from '../useCollectionSheet';

const testDatabase = { current: null as Database | null };

jest.mock('../../database', () => ({
    get database() {
        return testDatabase.current;
    },
}));

const COLLECTOR_ID = 'collector-sheet';
const TODAY = startOfDay(new Date()).getTime() + 43_200_000;
const YESTERDAY = subDays(new Date(), 1).getTime();
const TOMORROW = addDays(new Date(), 1).getTime();

interface SheetProps {
    collectorId?: string | null;
    asOfDate: Date;
    searchQuery?: string;
    onRefresh?: () => void | Promise<void>;
}

function renderSheet(initial: Partial<SheetProps> = {}) {
    return renderHook(
        (props: SheetProps) => useCollectionSheet(props),
        { initialProps: { collectorId: COLLECTOR_ID, asOfDate: new Date(TODAY), ...initial } },
    );
}

interface SeedRow {
    name: string;
    routeIndex: number;
    area: string;
    scheduleDue: number;
    scheduleAmount: number;
    scheduleStatus?: string;
    loanStatus?: string;
}

/** One borrower + one loan + one schedule each; returns ids keyed by borrower name. */
async function seed(rows: SeedRow[]) {
    const db = testDatabase.current!;
    const created: Record<string, { loanId: string; scheduleId: string }> = {};

    for (const row of rows) {
        await db.write(async () => {
            const borrower = await db.get<Borrower>('borrowers').create((b) => {
                b.fullName = row.name;
                b.collectorId = COLLECTOR_ID;
                b.routeIndex = row.routeIndex;
                b.area = row.area;
            });
            const loan = await db.get<Loan>('loans').create((l) => {
                l.borrowerId = borrower.id;
                l.status = row.loanStatus || 'active';
                l.principalAmount = 1000;
                l.interestAmount = 200;
                l.totalAmount = 1200;
                l.frequency = 'daily';
                l.installmentAmount = row.scheduleAmount;
            });
            const schedule = await db.get<PaymentSchedule>('payment_schedules').create((s) => {
                s.loanId = loan.id;
                s.scheduledAmount = row.scheduleAmount;
                s.status = row.scheduleStatus || 'pending';
                s.dueDate = row.scheduleDue;
            });
            created[row.name] = { loanId: loan.id, scheduleId: schedule.id };
        });
    }

    return created;
}

/**
 * Three rows that must surface (one overdue, two due today with equal routeIndex so
 * area decides) and three that must never: future-dated, already paid, closed loan.
 */
const STANDARD_SEED: SeedRow[] = [
    { name: 'Alpha Overdue', routeIndex: 2, area: 'North', scheduleDue: YESTERDAY, scheduleAmount: 500 },
    { name: 'Bravo East', routeIndex: 1, area: 'East', scheduleDue: TODAY, scheduleAmount: 300 },
    { name: 'Carlos South', routeIndex: 1, area: 'South', scheduleDue: TODAY, scheduleAmount: 200 },
    { name: 'Dana Future', routeIndex: 1, area: 'West', scheduleDue: TOMORROW, scheduleAmount: 900 },
    { name: 'Elon Paid', routeIndex: 1, area: 'Vale', scheduleDue: TODAY, scheduleAmount: 111, scheduleStatus: 'paid' },
    { name: 'Faye Closed', routeIndex: 1, area: 'Dale', scheduleDue: TODAY, scheduleAmount: 222, loanStatus: 'closed' },
];

describe('useCollectionSheet', () => {
    let db: Database;

    beforeEach(async () => {
        db = createTestDatabase();
        testDatabase.current = db;

        await db.write(async () => {
            for (const table of ['payment_schedules', 'payments', 'loans', 'borrowers']) {
                const existing = await db.get(table).query().fetch();
                for (const row of existing) await row.destroyPermanently();
            }
        });
    });

    afterEach(async () => {
        testDatabase.current = null;
        await closeTestDatabase(db);
    });

    it('joins borrowers, active loans and due schedules, overdue first then route then area', async () => {
        await seed(STANDARD_SEED);

        const { result } = renderSheet();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.items.map((item) => item.borrower.fullName)).toEqual([
            'Alpha Overdue',
            'Bravo East',
            'Carlos South',
        ]);
        expect(result.current.items.map((item) => item.schedule.scheduledAmount)).toEqual([500, 300, 200]);
    });

    it('exposes the joined loan and schedule for each item', async () => {
        const created = await seed(STANDARD_SEED);

        const { result } = renderSheet();

        await waitFor(() => {
            expect(result.current.items).toHaveLength(3);
        });

        const alpha = result.current.items.find((i) => i.borrower.fullName === 'Alpha Overdue')!;
        expect(alpha.loan.id).toBe(created['Alpha Overdue'].loanId);
        expect(alpha.schedule.id).toBe(created['Alpha Overdue'].scheduleId);
    });

    it('drops an item once its schedule is settled, without remounting', async () => {
        const created = await seed(STANDARD_SEED);

        const { result } = renderSheet();

        await waitFor(() => {
            expect(result.current.items).toHaveLength(3);
        });

        await act(async () => {
            await db.write(async () => {
                const schedule = await db
                    .get<PaymentSchedule>('payment_schedules')
                    .find(created['Bravo East'].scheduleId);
                await schedule.update((s) => {
                    s.status = 'paid';
                });
            });
        });

        await waitFor(() => {
            expect(result.current.items).toHaveLength(2);
        });
        expect(result.current.items.map((i) => i.borrower.fullName)).toEqual([
            'Alpha Overdue',
            'Carlos South',
        ]);
    });

    it('adds a new collection to the sheet when a schedule is created, without remounting', async () => {
        const created = await seed(STANDARD_SEED);

        const { result } = renderSheet();

        await waitFor(() => {
            expect(result.current.items).toHaveLength(3);
        });

        await act(async () => {
            await db.write(async () => {
                await db.get<PaymentSchedule>('payment_schedules').create((s) => {
                    s.loanId = created['Carlos South'].loanId;
                    s.scheduledAmount = 750;
                    s.status = 'pending';
                    s.dueDate = TODAY;
                });
            });
        });

        await waitFor(() => {
            expect(result.current.items).toHaveLength(4);
        });
        expect(result.current.items.filter((i) => i.borrower.fullName === 'Carlos South')).toHaveLength(2);
    });

    it('filters the sheet by the live search term', async () => {
        await seed(STANDARD_SEED);

        const { result } = renderSheet({ searchQuery: 'Bravo' });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.items.map((i) => i.borrower.fullName)).toEqual(['Bravo East']);
    });

    it('narrows and widens as the search term is retyped, without remounting', async () => {
        await seed(STANDARD_SEED);

        const { result, rerender } = renderSheet();

        await waitFor(() => {
            expect(result.current.items).toHaveLength(3);
        });

        rerender({ collectorId: COLLECTOR_ID, asOfDate: new Date(TODAY), searchQuery: 'Bravo' });
        await waitFor(() => {
            expect(result.current.items.map((i) => i.borrower.fullName)).toEqual(['Bravo East']);
        });

        rerender({ collectorId: COLLECTOR_ID, asOfDate: new Date(TODAY), searchQuery: 'Bravo Carlos' });
        await waitFor(() => {
            expect(result.current.items).toHaveLength(0);
        });

        rerender({ collectorId: COLLECTOR_ID, asOfDate: new Date(TODAY), searchQuery: '' });
        await waitFor(() => {
            expect(result.current.items).toHaveLength(3);
        });
    });

    it('recomputes when the sheet date moves earlier', async () => {
        await seed(STANDARD_SEED);

        const { result, rerender } = renderSheet();

        await waitFor(() => {
            expect(result.current.items).toHaveLength(3);
        });

        // A sheet dated yesterday keeps the overdue row but excludes today's.
        rerender({ collectorId: COLLECTOR_ID, asOfDate: new Date(YESTERDAY) });

        await waitFor(() => {
            expect(result.current.items.map((i) => i.borrower.fullName)).toEqual(['Alpha Overdue']);
        });
    });

    it('reports an empty sheet without a stuck spinner for an unassigned collector', async () => {
        await seed(STANDARD_SEED);

        const { result } = renderSheet({ collectorId: 'collector-nobody' });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.items).toEqual([]);
    });

    it('hands pull-to-refresh to the caller instead of refetching through a loader', async () => {
        await seed(STANDARD_SEED);

        const onRefresh = jest.fn().mockResolvedValue(undefined);
        const { result } = renderSheet({ onRefresh });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        const schedulesQuery = jest.spyOn(db.get<PaymentSchedule>('payment_schedules'), 'query');
        schedulesQuery.mockClear();

        await act(async () => {
            await result.current.refresh();
        });

        expect(onRefresh).toHaveBeenCalledTimes(1);
        expect(result.current.refreshing).toBe(false);
        expect(schedulesQuery).toHaveBeenCalledTimes(0);
        expect(result.current.items).toHaveLength(3);
    });
});
