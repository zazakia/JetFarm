import { useMemo } from 'react';
import { Q } from '@nozbe/watermelondb';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { endOfDay, startOfDay } from 'date-fns';

import { database } from '../database';
import Payment from '../database/models/Payment';
import Remittance from '../database/models/Remittance';
import { coerceMoneyAmount } from '../utils/currency';
import { columnTime } from '../utils/dates';
import { useObservedRecords } from './useObservedRecords';

const RECENT_LIMIT = 10;

interface UseCollectorRemittanceOptions {
    collectorId?: string | null;
}

function sumAmounts(records: Array<{ amount: number }>): number {
    return records.reduce((sum, record) => sum + coerceMoneyAmount(record.amount), 0);
}

function isSameDay(value: Date | number, start: number, end: number): boolean {
    const ts = columnTime(value);
    return ts >= start && ts <= end;
}

interface RemittanceLedger {
    payments: Payment[];
    approved: Remittance[];
    all: Remittance[];
}

const EMPTY_LEDGER: RemittanceLedger = { payments: [], approved: [], all: [] };

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
        (a, b) => columnTime(b.remittanceDate) - columnTime(a.remittanceDate),
    );
}

export function useCollectorRemittance(options: UseCollectorRemittanceOptions = {}) {
    const { collectorId } = options;

    // Fixed when the screen mounts, matching the daily collection figure on it.
    const { start, end } = useMemo(() => {
        const now = new Date();
        return { start: startOfDay(now).getTime(), end: endOfDay(now).getTime() };
    }, []);

    const records$ = useMemo(
        () => (collectorId ? buildLedger$(collectorId) : null),
        [collectorId],
    );

    const { records, loading } = useObservedRecords<RemittanceLedger>({
        records$,
        empty: EMPTY_LEDGER,
        label: 'useCollectorRemittance',
    });

    const totals = useMemo(() => {
        const todayCollection = sumAmounts(
            records.payments.filter((payment) => isSameDay(payment.paymentDate, start, end)),
        );
        const balance = sumAmounts(records.payments) - sumAmounts(records.approved);

        return {
            todayCollection,
            balance,
            remittances: recentFirst(records.all).slice(0, RECENT_LIMIT),
            suggestedAmount: balance > 0 ? balance : todayCollection,
        };
    }, [records, start, end]);

    return { ...totals, loading };
}
