import { useCallback, useEffect, useMemo, useState } from 'react';
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

export interface CollectorStats {
    todayCollection: number;
    outstanding: number;
    activeClients: number;
    efficiency: number;
    targetToday: number;
}

const EMPTY_STATS: CollectorStats = {
    todayCollection: 0,
    outstanding: 0,
    activeClients: 0,
    efficiency: 0,
    targetToday: 0,
};

interface DashboardRecords {
    borrowers: Borrower[];
    payments: Payment[];
    schedules: PaymentSchedule[];
}

interface UseCollectorDashboardOptions {
    collectorId?: string | null;
    /** Pull-to-refresh work that data observation cannot do on its own, e.g. a sync pass. */
    onRefresh?: () => void | Promise<void>;
}

/** WDB @date columns surface as epoch-ms or Date depending on the adapter and app version. */
function toTimestamp(value: Date | number): number {
    return value instanceof Date ? value.getTime() : Number(value);
}

function isDueOn(value: Date | number, start: number, end: number): boolean {
    const ts = toTimestamp(value);
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
    const [borrowers, setBorrowers] = useState<Borrower[]>([]);
    const [stats, setStats] = useState<CollectorStats>(EMPTY_STATS);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Fixed when the dashboard mounts, matching the daily-goal window on screen.
    const { start, end } = useMemo(startOfTodayRange, []);

    const records$ = useMemo(
        () => (collectorId ? buildRecords$(collectorId, start, end) : null),
        [collectorId, start, end],
    );

    useEffect(() => {
        if (!records$) {
            setBorrowers([]);
            setStats(EMPTY_STATS);
            setLoading(false);
            return;
        }

        const subscription = records$.subscribe({
            next: ({ borrowers: assigned, payments, schedules }) => {
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

                setBorrowers(assigned);
                setStats({
                    todayCollection,
                    outstanding,
                    activeClients: assigned.length,
                    efficiency: targetToday > 0 ? (todayCollection / targetToday) * 100 : 0,
                    targetToday,
                });
                setLoading(false);
                setRefreshing(false);
            },
            error: (error) => {
                console.error('[useCollectorDashboard] Observation failed', error);
                setLoading(false);
                setRefreshing(false);
            },
        });

        return () => subscription.unsubscribe();
    }, [records$, start, end]);

    // Reads are reactive, so pull-to-refresh only drives the sync pass a caller attaches.
    const refresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await onRefresh?.();
        } catch (error) {
            console.error('[useCollectorDashboard] Refresh task failed', error);
        } finally {
            setRefreshing(false);
        }
    }, [onRefresh]);

    return { borrowers, stats, loading, refreshing, refresh };
}
