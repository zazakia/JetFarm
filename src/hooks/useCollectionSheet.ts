import { useCallback, useEffect, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { endOfDay, isPast, isToday } from 'date-fns';

import { database } from '../database';
import Borrower from '../database/models/Borrower';
import Loan from '../database/models/Loan';
import PaymentSchedule from '../database/models/PaymentSchedule';

export interface CollectionItem {
    borrower: Borrower;
    loan: Loan;
    schedule: PaymentSchedule;
}

interface UseCollectionSheetOptions {
    collectorId?: string | null;
    /** The date the sheet is being worked for; schedules due later are excluded. */
    asOfDate: Date;
    /** Filter on borrower name; empty or whitespace means no filter. */
    searchQuery?: string;
    /** Pull-to-refresh work that data observation cannot do on its own, e.g. a sync pass. */
    onRefresh?: () => void | Promise<void>;
}

function toTimestamp(value: Date | number): number {
    return value instanceof Date ? value.getTime() : Number(value);
}

/** Overdue collections first, then the collector's route order, then area. */
function compareItems(a: CollectionItem, b: CollectionItem): number {
    const dueA = new Date(toTimestamp(a.schedule.dueDate));
    const dueB = new Date(toTimestamp(b.schedule.dueDate));
    const overdueA = isPast(dueA) && !isToday(dueA);
    const overdueB = isPast(dueB) && !isToday(dueB);

    if (overdueA && !overdueB) return -1;
    if (!overdueA && overdueB) return 1;
    if (a.borrower.routeIndex !== b.borrower.routeIndex) {
        return (a.borrower.routeIndex || 0) - (b.borrower.routeIndex || 0);
    }
    return (a.borrower.area || '').localeCompare(b.borrower.area || '');
}

function observeAssignedBorrowers(collectorId: string, searchQuery: string): Observable<Borrower[]> {
    const clauses = [Q.where('collector_id', collectorId)];
    if (searchQuery.trim()) {
        clauses.push(Q.where('full_name', Q.like(`%${searchQuery.trim()}%`)));
    }
    return database.get<Borrower>('borrowers').query(...clauses).observe();
}

function joinItems(
    borrowers: Borrower[],
    loans: Loan[],
    schedules: PaymentSchedule[],
): CollectionItem[] {
    const loansById = new Map(loans.map((loan) => [loan.id, loan]));
    const borrowersById = new Map(borrowers.map((borrower) => [borrower.id, borrower]));

    return schedules
        .map((schedule) => {
            const loan = loansById.get(schedule.loanId);
            const borrower = loan ? borrowersById.get(loan.borrowerId) : undefined;
            return loan && borrower ? { borrower, loan, schedule } : null;
        })
        .filter((item): item is CollectionItem => item !== null)
        .sort(compareItems);
}

function buildItems$(collectorId: string, searchQuery: string, asOfEnd: number): Observable<CollectionItem[]> {
    return observeAssignedBorrowers(collectorId, searchQuery).pipe(
        switchMap((borrowers) => {
            const borrowerIds = borrowers.map((borrower) => borrower.id);
            if (borrowerIds.length === 0) return of([]);

            return database
                .get<Loan>('loans')
                .query(Q.where('borrower_id', Q.oneOf(borrowerIds)), Q.where('status', 'active'))
                .observe()
                .pipe(
                    switchMap((loans) => {
                        const loanIds = loans.map((loan) => loan.id);
                        if (loanIds.length === 0) return of([]);

                        return database
                            .get<PaymentSchedule>('payment_schedules')
                            .query(
                                Q.where('loan_id', Q.oneOf(loanIds)),
                                Q.where('due_date', Q.lte(asOfEnd)),
                                Q.where('status', Q.notEq('paid')),
                            )
                            .observe()
                            .pipe(map((schedules) => joinItems(borrowers, loans, schedules)));
                    }),
                );
        }),
    );
}

/**
 * The collector's pending field list as one reactive join across borrowers, loans and
 * payment schedules, so collecting a payment removes its row immediately without a refetch.
 */
export function useCollectionSheet(options: UseCollectionSheetOptions) {
    const { collectorId, asOfDate, searchQuery = '', onRefresh } = options;
    const [items, setItems] = useState<CollectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const asOfEnd = useMemo(() => endOfDay(asOfDate).getTime(), [asOfDate]);

    const items$ = useMemo(
        () => (collectorId ? buildItems$(collectorId, searchQuery, asOfEnd) : null),
        [collectorId, searchQuery, asOfEnd],
    );

    useEffect(() => {
        if (!items$) {
            setItems([]);
            setLoading(false);
            return;
        }

        const subscription = items$.subscribe({
            next: (collectionItems) => {
                setItems(collectionItems);
                setLoading(false);
                setRefreshing(false);
            },
            error: (error) => {
                console.error('[useCollectionSheet] Observation failed', error);
                setLoading(false);
                setRefreshing(false);
            },
        });

        return () => subscription.unsubscribe();
    }, [items$]);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await onRefresh?.();
        } catch (error) {
            console.error('[useCollectionSheet] Refresh task failed', error);
        } finally {
            setRefreshing(false);
        }
    }, [onRefresh]);

    return { items, loading, refreshing, refresh };
}
