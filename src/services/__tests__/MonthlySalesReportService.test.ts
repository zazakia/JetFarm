import { MonthlySalesReportService, MonthlySalesReportRow } from '../MonthlySalesReportService';

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
    if (value instanceof Date) return '20-Mar-2026';
    return '20-Mar-2026';
});

const mockSimpleReportHtml = jest.fn(
    (title: string, subtitle: string, table: string, totals?: string) =>
        `<html><body><h1>${title}</h1><p>${subtitle}</p>${table}${totals ? `<div class="totals">${totals}</div>` : ''}</body></html>`
);

const mockFormat = jest.fn((date: Date, fmt: string) => {
    if (fmt === 'MMMM yyyy') return 'June 2026';
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

function makeRow(overrides: Partial<MonthlySalesReportRow> = {}): MonthlySalesReportRow {
    return {
        dueDate: new Date('2026-06-15'),
        customerName: 'Test Customer',
        accountNumber: 'ACC-001',
        amountPaid: 1000,
        principal: 800,
        interest: 150,
        vat: 50,
        unclaimedRebates: 10,
        ...overrides,
    };
}

describe('MonthlySalesReportService', () => {
    describe('totals', () => {
        it('computes all 5 aggregates correctly', () => {
            const rows: MonthlySalesReportRow[] = [
                makeRow({ amountPaid: 1000, principal: 800, interest: 150, vat: 50, unclaimedRebates: 20 }),
                makeRow({ amountPaid: 2000, principal: 1600, interest: 300, vat: 100, unclaimedRebates: 40 }),
                makeRow({ amountPaid: 500, principal: 400, interest: 75, vat: 25, unclaimedRebates: 10 }),
            ];

            const result = MonthlySalesReportService.totals(rows);

            expect(result.amountPaid).toBe(3500);
            expect(result.principal).toBe(2800);
            expect(result.interest).toBe(525);
            expect(result.vat).toBe(175);
            expect(result.unclaimedRebates).toBe(70);
        });

        it('handles empty array with all zeros', () => {
            const result = MonthlySalesReportService.totals([]);

            expect(result.amountPaid).toBe(0);
            expect(result.principal).toBe(0);
            expect(result.interest).toBe(0);
            expect(result.vat).toBe(0);
            expect(result.unclaimedRebates).toBe(0);
        });

        it('treats undefined and null values as 0', () => {
            const rows: MonthlySalesReportRow[] = [
                makeRow({ amountPaid: undefined as unknown as number, principal: null as unknown as number, interest: 100, vat: 20, unclaimedRebates: undefined }),
            ];

            const result = MonthlySalesReportService.totals(rows);

            expect(result.amountPaid).toBe(0);
            expect(result.principal).toBe(0);
            expect(result.interest).toBe(100);
            expect(result.vat).toBe(20);
            expect(result.unclaimedRebates).toBe(0);
        });
    });

    describe('buildHtml', () => {
        const month = new Date('2026-06-01');
        const rows: MonthlySalesReportRow[] = [
            makeRow({
                dueDate: new Date('2026-06-01'),
                customerName: 'Alice',
                establishment: 'Cafe A',
                accountNumber: 'ACC-100',
                status: 'PAID',
                datePaid: new Date('2026-06-02'),
                amountPaid: 1000,
                principal: 800,
                interest: 150,
                vat: 50,
                unclaimedRebates: 20,
            }),
            makeRow({
                dueDate: new Date('2026-06-15'),
                customerName: 'Bob',
                establishment: 'Resto B',
                accountNumber: 'ACC-200',
                status: 'UNPAID',
                datePaid: null,
                amountPaid: 2000,
                principal: 1600,
                interest: 300,
                vat: 100,
                unclaimedRebates: 40,
            }),
        ];

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('contains expected header and row data', () => {
            const html = MonthlySalesReportService.buildHtml(rows, month);

            // Title includes company name and "MONTHLY COLLECTIONS"
            expect(html).toContain('TEST CO MONTHLY COLLECTIONS');
            // Subtitle is the formatted month
            expect(html).toContain('JUNE 2026');
            // Table headers
            expect(html).toContain('S/N');
            expect(html).toContain('Due Date');
            expect(html).toContain('Customer Name');
            expect(html).toContain('Establishment');
            expect(html).toContain('Account No.');
            expect(html).toContain('Status');
            expect(html).toContain('Date Paid');
            expect(html).toContain('Amount Paid');
            expect(html).toContain('Principal');
            expect(html).toContain('Interest');
            expect(html).toContain('Fees');
            expect(html).toContain('Unclaimed Rebates');

            // Row data appears via mock functions (money calls)
            expect(mockMoney).toHaveBeenCalled();
        });

        it('shows "ACTUAL" totals row in footer', () => {
            const html = MonthlySalesReportService.buildHtml(rows, month);

            expect(html).toContain('ACTUAL');
            // Footer should contain the summed totals (via money mock)
            expect(html).toContain('PHP 3,000'); // amountPaid: 1000 + 2000
        });

        it('escapes HTML in customer names via escapeHtml', () => {
            const html = MonthlySalesReportService.buildHtml(rows, month);

            // escapeHtml should have been called for each row's customerName
            expect(mockEscapeHtml).toHaveBeenCalledWith('Alice');
            expect(mockEscapeHtml).toHaveBeenCalledWith('Bob');
        });

        it('escapes HTML in establishment and account number', () => {
            MonthlySalesReportService.buildHtml(rows, month);

            expect(mockEscapeHtml).toHaveBeenCalledWith('Cafe A');
            expect(mockEscapeHtml).toHaveBeenCalledWith('Resto B');
            expect(mockEscapeHtml).toHaveBeenCalledWith('ACC-100');
            expect(mockEscapeHtml).toHaveBeenCalledWith('ACC-200');
        });

        it('calls reportDate for date fields', () => {
            MonthlySalesReportService.buildHtml(rows, month);

            expect(mockReportDate).toHaveBeenCalled();
        });

        it('calls simpleReportHtml with correct arguments', () => {
            MonthlySalesReportService.buildHtml(rows, month);

            expect(mockSimpleReportHtml).toHaveBeenCalledTimes(1);
            const [title, subtitle, table] = mockSimpleReportHtml.mock.calls[0];
            expect(title).toBe('TEST CO MONTHLY COLLECTIONS');
            expect(subtitle).toBe('JUNE 2026');
            expect(table).toContain('<table>');
            expect(table).toContain('ACTUAL');
        });
    });
});
