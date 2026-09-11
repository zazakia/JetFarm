import { CashAdvanceReportService, CashAdvanceReportRow } from '../CashAdvanceReportService';

jest.mock('../../utils/currency', () => ({
    formatPHP: jest.fn((value) => `PHP ${value}`),
}));

describe('CashAdvanceReportService', () => {
    describe('totalAdvance', () => {
        it('sums cheque and cash amounts', () => {
            const row: CashAdvanceReportRow = {
                clientNumber: 'C001',
                clientName: 'Test Client',
                termsInMonths: 12,
                ratePerMonth: 0.02,
                chequeAmount: 5000,
                cashAmount: 3000,
            };
            expect(CashAdvanceReportService.totalAdvance(row)).toBe(8000);
        });

        it('handles missing chequeAmount (treats as 0)', () => {
            const row: CashAdvanceReportRow = {
                clientNumber: 'C001',
                clientName: 'Test Client',
                termsInMonths: 12,
                ratePerMonth: 0.02,
                cashAmount: 3000,
            };
            expect(CashAdvanceReportService.totalAdvance(row)).toBe(3000);
        });

        it('handles missing cashAmount (treats as 0)', () => {
            const row: CashAdvanceReportRow = {
                clientNumber: 'C001',
                clientName: 'Test Client',
                termsInMonths: 12,
                ratePerMonth: 0.02,
                chequeAmount: 5000,
            };
            expect(CashAdvanceReportService.totalAdvance(row)).toBe(5000);
        });

        it('returns 0 when both amounts are missing', () => {
            const row: CashAdvanceReportRow = {
                clientNumber: 'C001',
                clientName: 'Test Client',
                termsInMonths: 12,
                ratePerMonth: 0.02,
            };
            expect(CashAdvanceReportService.totalAdvance(row)).toBe(0);
        });
    });

    describe('buildHtml', () => {
        const sampleRows: CashAdvanceReportRow[] = [
            {
                clientNumber: 'C001',
                establishment: 'Est A',
                institution: 'Inst A',
                clientName: 'Client One',
                date: new Date('2026-03-20'),
                maturityDate: new Date('2026-06-20'),
                termsInMonths: 12,
                ratePerMonth: 0.02,
                chequeAmount: 5000,
                cashAmount: 3000,
                deductions: 'None',
            },
            {
                clientNumber: 'C002',
                establishment: 'Est B',
                institution: 'Inst B',
                clientName: 'Client Two',
                date: new Date('2026-04-01'),
                maturityDate: new Date('2026-07-01'),
                termsInMonths: 6,
                ratePerMonth: 0.015,
                chequeAmount: 2000,
                cashAmount: 1500,
                deductions: 'Tax',
            },
        ];

        it('contains expected header and row data', () => {
            const html = CashAdvanceReportService.buildHtml(sampleRows);
            expect(html).toContain('<h1>CASH ADVANCES</h1>');
            expect(html).toContain('Cash advance monitoring report');
            expect(html).toContain('Client No.');
            expect(html).toContain('Establishment');
            expect(html).toContain('Client One');
            expect(html).toContain('Client Two');
            expect(html).toContain('PHP 5000');
            expect(html).toContain('PHP 3000');
        });

        it('shows correct totals in footer', () => {
            const html = CashAdvanceReportService.buildHtml(sampleRows);
            // Total cheque: 5000 + 2000 = 7000
            expect(html).toContain('PHP 7000');
            // Total cash: 3000 + 1500 = 4500
            expect(html).toContain('PHP 4500');
            // Grand total: 7000 + 4500 = 11500
            expect(html).toContain('PHP 11500');
            expect(html).toContain('TOTAL');
        });

        it('uses custom title when provided', () => {
            const html = CashAdvanceReportService.buildHtml(sampleRows, 'MY CUSTOM TITLE');
            expect(html).toContain('<h1>MY CUSTOM TITLE</h1>');
        });

        it('handles empty rows array', () => {
            const html = CashAdvanceReportService.buildHtml([]);
            expect(html).toContain('<h1>CASH ADVANCES</h1>');
            expect(html).toContain('PHP 0');
            expect(html).toContain('TOTAL');
        });
    });
});
