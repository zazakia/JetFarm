import { useMemo } from 'react';
import { Q } from '@nozbe/watermelondb';
import { combineLatest, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { endOfDay, startOfDay } from 'date-fns';

import { database } from '../database';
import Borrower from '../database/models/Borrower';
import Loan from '../database/models/Loan';
import Payment from '../database/models/Payment';
import PaymentSchedule from '../database/models/PaymentSchedule';
import { coerceMoneyAmount } from '../utils/currency';
import { columnTime } from '../utils/dates';
import { useObservedRecords } from './useObservedRecords';

export interface CollectorStats {
    todayCollection: number;
    outstanding: number;
    activeClients: number;
    efficiency: number;
    targetToday: number;
}

interface DashboardRecords {
    borrowers: Borrower[];
    payments: Payment[];
    schedules: PaymentSchedule[];
}

const EMPTY_RECORDS: DashboardRecords = { borrowers: [], payments: [], schedules: [] };

interface UseCollectorDashboardOptions {
    collectorId?: string | null;
    /** Pull-to-refresh work that data observation cannot do on its own, e.g. a sync pass. */
    onRefresh?: () => void | Promise<void>;
}

function isDueOn(value: Date | number, start: number, end: number): boolean {
    const ts = columnTime(value);
    return ts >= start && ts <= end;
}

function startOfTodayRange(): { start: number; end: number } {
    const now = new Date();
    return { start: startOfDay(now).getTime(), end: endOfDay(now).getTime() };
}

function observeLoans(borrowerIds: string[]): Observable<Loan[]> {
    if (borrowerIds.length === 0) return of([]);
    return database
        .get<Loan>('loans')
        .query(Q.where('borrower_id', Q.oneOf(borrowerIds)), Q.where('status', 'active'))
        .observe();
}

function observeSchedules(loanIds: string[]): Observable<PaymentSchedule[]> {
    if (loanIds.length === 0) return of([]);
    return database
        .get<PaymentSchedule>('payment_schedules')
        .query(Q.where('loan_id', Q.oneOf(loanIds)), Q.where('status', Q.notEq('paid')))
        .observe();
}

function buildRecords$(collectorId: string, start: number, end: number): Observable<DashboardRecords> {
    return database
        .get<Borrower>('borrowers')
        .query(Q.where('collector_id', collectorId))
        .observe()
        .pipe(
            switchMap((borrowers) =>
                observeLoans(borrowers.map((b) => b.id)).pipe(
                    switchMap((loans) =>
                        combineLatest([
                            database
                                .get<Payment>('payments')
                                .query(
                                    Q.where('collector_id', collectorId),
                                    Q.where('payment_date', Q.between(start, end)),
                                )
                                .observe(),
                            observeSchedules(loans.map((l) => l.id)),
                        ]).pipe(map(([payments, schedules]) => ({ borrowers, payments, schedules }))),
                    ),
                ),
            ),
        );
}

/**
 * Assignment list and KPI stats as reactive WatermelonDB queries, so a recorded
 * payment or a reassignment updates the dashboard without a refetch cycle.
 */
export function useCollectorDashboard(options: UseCollectorDashboardOptions = {}) {
    const { collectorId, onRefresh } = options;

    // Fixed when the dashboard mounts, matching the daily-goal window on screen.
    const { start, end } = useMemo(startOfTodayRange, []);

    const records$ = useMemo(
        () => (collectorId ? buildRecords$(collectorId, start, end) : null),
        [collectorId, start, end],
    );

    const {
        records: { borrowers, payments, schedules },
        loading,
        refreshing,
        refresh,
    } = useObservedRecords<DashboardRecords>({
        records$,
        empty: EMPTY_RECORDS,
        label: 'useCollectorDashboard',
        onRefresh,
    });

    const stats = useMemo<CollectorStats>(() => {
        const todayCollection = payments.reduce(
            (sum, payment) => sum + coerceMoneyAmount(payment.amount),
            0,
        );
        const outstanding = schedules.reduce(
            (sum, schedule) => sum + coerceMoneyAmount(schedule.scheduledAmount),
            0,
        );
        const targetToday = schedules
            .filter((schedule) => isDueOn(schedule.dueDate, start, end))
            .reduce((sum, schedule) => sum + coerceMoneyAmount(schedule.scheduledAmount), 0);

        return {
            todayCollection,
            outstanding,
            activeClients: borrowers.length,
            efficiency: targetToday > 0 ? (todayCollection / targetToday) * 100 : 0,
            targetToday,
        };
    }, [borrowers, payments, schedules, start, end]);

    return { borrowers, stats, loading, refreshing, refresh };
}
