import { 
    formatDate, 
    formatDateShort, 
    formatDateTime, 
    formatRelative, 
    toDate, 
    toTimestamp, 
    daysOverdue, 
    addFrequency, 
    skipSunday, 
    addNextDaySkipSunday, 
    addFrequencySkipSunday,
    startOfToday,
    endOfToday,
    parseDateLocal,
} from '../dates';
import { format, isValid } from 'date-fns';

describe('dates utility', () => {
  const mockDate = new Date('2026-03-15T12:00:00Z');
  const mockTimestamp = mockDate.getTime();

  describe('formatDate', () => {
    it('formats a date object', () => {
      expect(formatDate(mockDate)).toBe('Mar 15, 2026');
    });
    it('returns N/A for null/undefined/invalid', () => {
        expect(formatDate(null)).toBe('N/A');
        expect(formatDate(undefined)).toBe('N/A');
        expect(formatDate('invalid-date')).toBe('N/A');
    });
  });

  describe('formatDateShort', () => {
    it('formats as MM/dd/yyyy', () => {
        expect(formatDateShort(mockDate)).toBe('03/15/2026');
    });
    it('returns N/A for null/undefined/invalid', () => {
        expect(formatDateShort(null)).toBe('N/A');
        expect(formatDateShort(undefined)).toBe('N/A');
        expect(formatDateShort('invalid-date')).toBe('N/A');
    });
  });

  describe('formatDateTime', () => {
    it('includes time', () => {
        const result = formatDateTime(mockDate);
        expect(result).toMatch(/Mar 15, 2026/);
        expect(result).toMatch(/\d{1,2}:\d{2} [AP]M/);
    });
    it('returns N/A for null/undefined/invalid', () => {
        expect(formatDateTime(null)).toBe('N/A');
        expect(formatDateTime(undefined)).toBe('N/A');
        expect(formatDateTime('invalid-date')).toBe('N/A');
    });
  });

  describe('formatRelative', () => {
    it('returns relative time string', () => {
        const past = new Date(Date.now() - 3600000);
        expect(formatRelative(past)).toContain('ago');
    });
    it('returns N/A for null/undefined/invalid', () => {
        expect(formatRelative(null)).toBe('N/A');
        expect(formatRelative(undefined)).toBe('N/A');
        expect(formatRelative('invalid-date')).toBe('N/A');
    });
  });

  describe('toDate', () => {
    it('handles Date objects', () => {
        expect(toDate(mockDate)).toBe(mockDate);
    });
    it('returns null for null/undefined/empty/invalid', () => {
        expect(toDate(null)).toBeNull();
        expect(toDate(undefined)).toBeNull();
        expect(toDate('')).toBeNull();
    });
    it('handles numbers', () => {
        const d = toDate(mockTimestamp);
        expect(d?.getTime()).toBe(mockTimestamp);
    });
    it('handles ISO strings', () => {
        const d = toDate('2026-03-15T12:00:00Z');
        expect(isValid(d)).toBe(true);
    });
    it('handles regular date strings', () => {
        const d = toDate('Mar 15, 2026');
        expect(isValid(d)).toBe(true);
    });
    it('returns null for invalid inputs', () => {
        expect(toDate('invalid-date')).toBeNull();
        expect(toDate({} as any)).toBeNull();
    });
  });

  describe('toTimestamp', () => {
    it('converts date to ms', () => {
        expect(toTimestamp(mockDate)).toBe(mockTimestamp);
    });
    it('returns Date.now() for null', () => {
        const now = Date.now();
        expect(toTimestamp(null)).toBeGreaterThanOrEqual(now);
    });
  });

  describe('startOfToday / endOfToday', () => {
    it('returns start of today', () => {
        const d = startOfToday();
        expect(d.getHours()).toBe(0);
    });
    it('returns end of today', () => {
        const d = endOfToday();
        expect(d.getHours()).toBe(23);
    });
  });

  describe('daysOverdue', () => {
    it('returns 0 if not overdue', () => {
        const future = new Date(Date.now() + 86400000);
        expect(daysOverdue(future)).toBe(0);
    });
    it('returns positive days if overdue', () => {
        const past = new Date(Date.now() - 2 * 86400000);
        expect(daysOverdue(past)).toBeGreaterThanOrEqual(1);
    });
    it('returns 0 for invalid/empty inputs', () => {
        expect(daysOverdue('')).toBe(0);
        expect(daysOverdue(null as any)).toBe(0);
        expect(daysOverdue(undefined as any)).toBe(0);
    });
  });

  describe('addFrequency', () => {
    it('adds daily', () => {
        const d = new Date('2024-01-01');
        expect(addFrequency(d, 'daily').getDate()).toBe(2);
    });
    it('adds weekly', () => {
        const d = new Date('2024-01-01');
        expect(addFrequency(d, 'weekly').getDate()).toBe(8);
    });
    it('adds bi_monthly', () => {
        const d = new Date('2024-01-01');
        expect(addFrequency(d, 'bi_monthly').getDate()).toBe(16);
    });
    it('adds monthly', () => {
        const d = new Date('2024-01-01');
        expect(addFrequency(d, 'monthly').getMonth()).toBe(1);
    });
    it('defaults to monthly', () => {
        const d = new Date('2024-01-01');
        expect(addFrequency(d, 'unknown').getMonth()).toBe(1);
    });
  });

  describe('Sunday skipping logic', () => {
    it('skipSunday advances Sunday to Monday', () => {
        // 2024-01-07 is a Sunday
        const sunday = new Date('2024-01-07T00:00:00Z');
        const next = skipSunday(sunday);
        // PHP time is UTC+8, so 2024-01-07 00:00 UTC is 08:00 PHP (Sunday)
        expect(next.getUTCDate()).toBe(8);
    });

    it('addNextDaySkipSunday skips Sunday', () => {
        const saturday = new Date('2024-01-06T00:00:00Z');
        const next = addNextDaySkipSunday(saturday);
        expect(next.getUTCDate()).toBe(8); // Saturday + 1 is Sunday, so skips to Monday (8th)
    });

    it('addFrequencySkipSunday handles daily skipping Sunday', () => {
        const saturday = new Date('2024-01-06T00:00:00Z');
        const next = addFrequencySkipSunday(saturday, 'daily');
        expect(next.getUTCDate()).toBe(8);
    });

    it('addFrequencySkipSunday handles weekly', () => {
        const d = new Date('2024-01-01T00:00:00Z');
        const next = addFrequencySkipSunday(d, 'weekly');
        expect(next.getUTCDate()).toBe(8);
    });

    it('addFrequencySkipSunday handles bi_monthly', () => {
        const d = new Date('2024-01-01T00:00:00Z');
        const next = addFrequencySkipSunday(d, 'bi_monthly');
        expect(next.getUTCDate()).toBe(16);
    });

    it('addFrequencySkipSunday handles monthly and default', () => {
        const d = new Date('2024-01-01T00:00:00Z');
        expect(addFrequencySkipSunday(d, 'monthly').getUTCMonth()).toBe(1); // Feb
        expect(addFrequencySkipSunday(d, 'unknown').getUTCMonth()).toBe(1); // Default to monthly
    });
  });

  // ─────────────────────────────────────────────────────────
  // parseDateLocal — UTC-safe YYYY-MM-DD parsing
  // ─────────────────────────────────────────────────────────
  describe('parseDateLocal', () => {
    it('returns a local-midnight timestamp for a YYYY-MM-DD string', () => {
        const ts = parseDateLocal('1990-05-15');
        expect(ts).not.toBeNull();
        const d = new Date(ts!);
        expect(d.getFullYear()).toBe(1990);
        expect(d.getMonth()).toBe(4);   // May (0-indexed)
        expect(d.getDate()).toBe(15);
    });

    it('never shifts the date backward due to UTC offset (regression for UTC+8)', () => {
        // new Date('1990-05-15') is UTC midnight → May 14 at 16:00 UTC = local May 15 at 00:00 UTC+8
        // But in UTC-8 it would be May 14 at 16:00 local time — parseDateLocal avoids all this
        const ts = parseDateLocal('1990-05-15')!;
        const d = new Date(ts);
        // Regardless of the machine's timezone, local date must match input
        expect(d.getDate()).toBe(15);
        expect(d.getMonth()).toBe(4); // May
    });

    it('correctly parses Jan 1 without shifting to Dec 31', () => {
        const ts = parseDateLocal('2024-01-01');
        expect(ts).not.toBeNull();
        const d = new Date(ts!);
        expect(d.getFullYear()).toBe(2024);
        expect(d.getMonth()).toBe(0);   // January
        expect(d.getDate()).toBe(1);
    });

    it('returns null for empty string', () => {
        expect(parseDateLocal('')).toBeNull();
    });

    it('returns null for null input', () => {
        expect(parseDateLocal(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
        expect(parseDateLocal(undefined)).toBeNull();
    });

    it('returns null for a non-YYYY-MM-DD format string', () => {
        expect(parseDateLocal('not-a-date')).toBeNull();
        expect(parseDateLocal('2025')).toBeNull();
        expect(parseDateLocal('05/15/1990')).toBeNull();
    });

    it('returns null for strings with wrong number of parts after splitting by -', () => {
        expect(parseDateLocal('2024-01')).toBeNull(); // Only 2 parts
    });
  });
});
