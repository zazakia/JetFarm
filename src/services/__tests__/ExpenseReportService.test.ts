import { ExpenseReportService } from '../ExpenseReportService';

const mockEscapeHtml = jest.fn((value: unknown) => {
    if (value === null || value === undefined) return '';
    return String(value);
});

const mockMoney = jest.fn((value: unknown) => {
    const n = value || 0;
    return `PHP ${Number(n).toLocaleString()}`;
});

const mockReportDate = jest.fn((value: unknown) => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return '10-Jun-2026';
    return '10-Jun-2026';
});

const mockSimpleReportHtml = jest.fn(
    (title: string, subtitle: string, table: string, totals?: string) =>
        `<html><body><h1>${title}</h1><p>${subtitle}</p>${table}${totals ? `<div class="totals">${totals}</div>` : ''}</body></html>`
);

const mockFormat = jest.fn((date: Date, fmt: string) => {
    if (fmt === 'MMMM yyyy') return 'JUNE 2026';
    return String(date);
});

jest.mock('../reportFormatters', () => ({
    escapeHtml: (value: unknown) => mockEscapeHtml(value),
    money: (value: unknown) => mockMoney(value),
    reportDate: (value: unknown) => mockReportDate(value),
    simpleReportHtml: (title: string, subtitle: string, table: string, totals?: string) =>
        mockSimpleReportHtml(title, subtitle, table, totals),
}));

jest.mock('date-fns', () => ({
    format: (date: Date, fmt: string) => mockFormat(date, fmt),
}));

jest.mock('../../constants/brand', () => ({
    COMPANY_NAME: 'TEST CO',
}));

describe('ExpenseReportService', () => {
    describe('inferVatAmount', () => {
        it('always returns 0 since cooperatives are VAT-exempt', () => {
            expect(ExpenseReportService.inferVatAmount(1000, undefined, 120)).toBe(0);
            expect(ExpenseReportService.inferVatAmount(1000, '123-456', 120)).toBe(0);
            expect(ExpenseReportService.inferVatAmount(1000, 'non-vat', 120)).toBe(0);
            expect(ExpenseReportService.inferVatAmount(1000, '123-456')).toBe(0);
            expect(ExpenseReportService.inferVatAmount(500, '123-456')).toBe(0);
            expect(ExpenseReportService.inferVatAmount(0, '123-456')).toBe(0);
            expect(ExpenseReportService.inferVatAmount(1000, 'non-vat')).toBe(0);
        });
    });

    describe('buildHtml', () => {
        const month = new Date('2026-06-01');

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('contains COMPANY_NAME in header', () => {
            ExpenseReportService.buildHtml([], month);

            expect(mockSimpleReportHtml).toHaveBeenCalledTimes(1);
            const [title] = mockSimpleReportHtml.mock.calls[0];
            expect(title).toBe('TEST CO EXPENSES');
        });

        it('shows month in subtitle', () => {
            ExpenseReportService.buildHtml([], month);

            expect(mockSimpleReportHtml).toHaveBeenCalledTimes(1);
            const [, subtitle] = mockSimpleReportHtml.mock.calls[0];
            expect(subtitle).toBe('JUNE 2026');
        });

        it('shows correct value totals in footer', () => {
            const rows = [
                { expenseDate: new Date('2026-06-10'), amount: 1000, tin: '123-456' },
                { expenseDate: new Date('2026-06-15'), amount: 500, tin: '789-012' },
            ];
            ExpenseReportService.buildHtml(rows, month);

            expect(mockSimpleReportHtml).toHaveBeenCalledTimes(1);
            const [, , table] = mockSimpleReportHtml.mock.calls[0];
            // Total value: 1000 + 500 = 1500
            expect(table).toContain('PHP 1,500');
            expect(table).not.toContain('VAT');
            expect(table).toContain('TOTAL');
        });

        it('handles empty rows', () => {
            ExpenseReportService.buildHtml([], month);

            expect(mockSimpleReportHtml).toHaveBeenCalledTimes(1);
            const [, , table] = mockSimpleReportHtml.mock.calls[0];
            // Zero totals for empty rows
            expect(table).toContain('PHP 0');
            expect(table).toContain('TOTAL');
        });
    });
});
