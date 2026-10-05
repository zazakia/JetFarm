import { useEffect, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { endOfDay, startOfDay } from 'date-fns';

import { database } from '../database';
import Payment from '../database/models/Payment';
import Remittance from '../database/models/Remittance';
import { coerceMoneyAmount } from '../utils/currency';

const RECENT_LIMIT = 10;

interface UseCollectorRemittanceOptions {
    collectorId?: string | null;
}

/** WDB @date columns surface as epoch-ms or Date depending on the adapter and app version. */
function toTimestamp(value: Date | number): number {
    return value instanceof Date ? value.getTime() : Number(value);
}

function sumAmounts(records: Array<{ amount: number }>): number {
    return records.reduce((sum, record) => sum + coerceMoneyAmount(record.amount), 0);
}

function isSameDay(value: Date | number, start: number, end: number): boolean {
    const ts = toTimestamp(value);
    return ts >= start && ts <= end;
}

interface RemittanceLedger {
    payments: Payment[];
    approved: Remittance[];
    all: Remittance[];
}

/**
 * Cash held and the recent remittance list as observed queries. Every live payment minus
 * every approved remittance makes the held figure, which is exactly what
 * CashService.getCollectorBalance enforces, so the screen and the service cannot disagree.
 *
 * The approved set is queried separately, even though it is a subset of `all`: a query only
 * re-emits when rows enter or leave its result set, so a pending remittance turning approved
 * would otherwise leave the balance stale.
 */
function buildLedger$(collectorId: string): Observable<RemittanceLedger> {
    const payments$ = database
        .get<Payment>('payments')
        .query(Q.where('collector_id', collectorId), Q.where('deleted_at', null))
        .observe();

    const approved$ = database
        .get<Remittance>('remittances')
        .query(
            Q.where('collector_id', collectorId),
            Q.where('deleted_at', null),
            Q.where('status', 'approved'),
        )
        .observe();

    const all$ = database
        .get<Remittance>('remittances')
        .query(Q.where('collector_id', collectorId), Q.where('deleted_at', null))
        .observe();

    return combineLatest([payments$, approved$, all$]).pipe(
        map(([payments, approved, all]) => ({ payments, approved, all })),
    );
}

/** Newest first, so the collector sees what they handed in most recently. */
function recentFirst(remittances: Remittance[]): Remittance[] {
    return [...remittances].sort(
        (a, b) => toTimestamp(b.remittanceDate) - toTimestamp(a.remittanceDate),
    );
}

export function useCollectorRemittance(options: UseCollectorRemittanceOptions = {}) {
    const { collectorId } = options;
    const [todayCollection, setTodayCollection] = useState(0);
    const [balance, setBalance] = useState(0);
    const [remittances, setRemittances] = useState<Remittance[]>([]);
    const [loading, setLoading] = useState(true);

    // Fixed when the screen mounts, matching the daily collection figure on it.
    const { start, end } = useMemo(() => {
        const now = new Date();
        return { start: startOfDay(now).getTime(), end: endOfDay(now).getTime() };
    }, []);

    const ledger$ = useMemo(() => (collectorId ? buildLedger$(collectorId) : null), [collectorId]);

    useEffect(() => {
        if (!ledger$) {
            setTodayCollection(0);
            setBalance(0);
            setRemittances([]);
            setLoading(false);
            return;
        }

        const subscription = ledger$.subscribe({
            next: ({ payments, approved, all }) => {
                const collectedToday = sumAmounts(
                    payments.filter((payment) => isSameDay(payment.paymentDate, start, end)),
                );

                setTodayCollection(collectedToday);
                setBalance(sumAmounts(payments) - sumAmounts(approved));
                setRemittances(recentFirst(all).slice(0, RECENT_LIMIT));
                setLoading(false);
            },
            error: (error) => {
                console.error('[useCollectorRemittance] Observation failed', error);
                setLoading(false);
            },
        });

        return () => subscription.unsubscribe();
    }, [ledger$, start, end]);

    return {
        todayCollection,
        balance,
        remittances,
        suggestedAmount: balance > 0 ? balance : todayCollection,
        loading,
    };
}
