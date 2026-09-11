import { format, formatDistanceToNow, isValid, parseISO, startOfDay, endOfDay, addDays, addWeeks, addMonths, differenceInDays } from 'date-fns';

export function formatDate(date: Date | number | string | null | undefined): string {
    if (!date) return 'N/A';
    const d = toDate(date);
    if (!d || !isValid(d)) return 'N/A';
    return format(d, 'MMM dd, yyyy');
}

export function formatDateShort(date: Date | number | string | null | undefined): string {
    if (!date) return 'N/A';
    const d = toDate(date);
    if (!d || !isValid(d)) return 'N/A';
    return format(d, 'MM/dd/yyyy');
}

export function formatDateTime(date: Date | number | string | null | undefined): string {
    if (!date) return 'N/A';
    const d = toDate(date);
    if (!d || !isValid(d)) return 'N/A';
    return format(d, 'MMM dd, yyyy hh:mm a');
}

export function formatRelative(date: Date | number | string | null | undefined): string {
    if (!date) return 'N/A';
    const d = toDate(date);
    if (!d || !isValid(d)) return 'N/A';
    return formatDistanceToNow(d, { addSuffix: true });
}

export function toDate(value: Date | number | string | null | undefined): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
        const d = parseISO(value);
        if (isValid(d)) return d;
        const ms = Date.parse(value);
        if (!isNaN(ms)) return new Date(ms);
    }
    return null;
}

export function toTimestamp(date: Date | null | undefined): number {
    if (!date) return Date.now();
    return date.getTime();
}

export function startOfToday(): Date {
    return startOfDay(new Date());
}

export function endOfToday(): Date {
    return endOfDay(new Date());
}

export function daysOverdue(dueDate: Date | number | string): number {
    const d = toDate(dueDate);
    if (!d) return 0;
    const diff = differenceInDays(new Date(), d);
    return diff > 0 ? diff : 0;
}

export function addFrequency(date: Date, frequency: string): Date {
    switch (frequency) {
        case 'daily': return addDays(date, 1);
        case 'weekly': return addWeeks(date, 1);
        case 'bi_monthly': return addDays(date, 15);
        case 'monthly': return addMonths(date, 1);
        default: return addMonths(date, 1);
    }
}

/** If the date is a Sunday (UTC+8), advance it to Monday */
export function skipSunday(date: Date): Date {
    const d = new Date(date);
    // Philippine Time is UTC+8
    const phpDay = new Date(d.getTime() + 8 * 60 * 60 * 1000).getUTCDay();
    if (phpDay === 0) {
        return addDays(d, 1);
    }
    return d;
}

/** Return next day after the given date, skipping Sunday (UTC+8) */
export function addNextDaySkipSunday(date: Date): Date {
    const next = addDays(new Date(date), 1);
    return skipSunday(next);
}

/** Apply frequency increment then skip Sunday (UTC+8) */
export function addFrequencySkipSunday(date: Date, frequency: string): Date {
    let next: Date;
    switch (frequency) {
        case 'daily':
            next = addDays(date, 1);
            // Skip Sunday in Philippine Time
            const phpDayDaily = new Date(next.getTime() + 8 * 60 * 60 * 1000).getUTCDay();
            if (phpDayDaily === 0) next = addDays(next, 1);
            return next;
        case 'weekly': return skipSunday(addWeeks(date, 1));
        case 'bi_monthly': return skipSunday(addDays(date, 15));
        case 'monthly': return skipSunday(addMonths(date, 1));
        default: return skipSunday(addMonths(date, 1));
    }
}

/**
 * Parse a "YYYY-MM-DD" date string as LOCAL midnight (not UTC midnight).
 *
 * `new Date("1990-05-15")` is spec'd as UTC 00:00, which in UTC+8 renders as
 * May 14 23:00 local time — showing the wrong day.  This helper avoids that
 * by constructing the Date from its year/month/day parts in local time.
 *
 * @param dateStr  A date string in "YYYY-MM-DD" format.
 * @returns        Unix timestamp (ms) at local midnight, or null if the input
 *                 is empty or invalid.
 */
export function parseDateLocal(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    const d = new Date(year, month, day);
    if (!isValid(d)) return null;
    return d.getTime();
}
