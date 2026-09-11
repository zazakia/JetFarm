import {
    ClientSoaMasterlistService,
    ClientSoaMasterlistRow,
} from '../ClientSoaMasterlistService';

jest.mock('../reportFormatters', () => ({
    escapeHtml: jest.fn((value: any) => (value == null ? '' : String(value))),
    money: jest.fn((value: any) => `PHP ${value || 0}`),
    reportDate: jest.fn((value: any) => (value ? '01-Jan-2020' : '')),
    simpleReportHtml: jest.fn(
        (title: string, subtitle: string, table: string) =>
            `<html><body><h1>${title}</h1><p>${subtitle}</p>${table}</body></html>`,
    ),
}));

const makeRow = (
    overrides: Partial<ClientSoaMasterlistRow> = {},
): ClientSoaMasterlistRow => ({
    lastName: 'Doe',
    firstName: 'John',
    accountNumber: 'ACC-001',
    totalPromissoryNoteAmount: 10000,
    amountPaid: 3000,
    principalPaid: 2500,
    ...overrides,
});

describe('ClientSoaMasterlistService', () => {
    describe('balance', () => {
        it('calculates correctly for positive balance', () => {
            const row = makeRow({
                totalPromissoryNoteAmount: 10000,
                amountPaid: 3000,
            });
            expect(ClientSoaMasterlistService.balance(row)).toBe(7000);
        });

        it('returns 0 when fully paid', () => {
            const row = makeRow({
                totalPromissoryNoteAmount: 5000,
                amountPaid: 5000,
            });
            expect(ClientSoaMasterlistService.balance(row)).toBe(0);
        });

        it('returns 0 when overpaid', () => {
            const row = makeRow({
                totalPromissoryNoteAmount: 5000,
                amountPaid: 7000,
            });
            expect(ClientSoaMasterlistService.balance(row)).toBe(0);
        });

        it('handles missing totalPromissoryNoteAmount', () => {
            const row = makeRow({
                totalPromissoryNoteAmount: (undefined as any),
                amountPaid: 1000,
            });
            expect(ClientSoaMasterlistService.balance(row)).toBe(0);
        });

        it('handles missing amountPaid', () => {
            const row = makeRow({
                totalPromissoryNoteAmount: 5000,
                amountPaid: (undefined as any),
            });
            expect(ClientSoaMasterlistService.balance(row)).toBe(5000);
        });

        it('handles both values missing', () => {
            const row = makeRow({
                totalPromissoryNoteAmount: (undefined as any),
                amountPaid: (undefined as any),
            });
            expect(ClientSoaMasterlistService.balance(row)).toBe(0);
        });
    });

    describe('buildHtml', () => {
        it('contains expected header', () => {
            const html = ClientSoaMasterlistService.buildHtml([
                makeRow(),
            ]);
            expect(html).toContain('<h1>CLIENTS SOA MASTERLIST</h1>');
            expect(html).toContain(
                'All client statement-of-account records',
            );
        });

        it('shows correct totals in footer for a single row', () => {
            const html = ClientSoaMasterlistService.buildHtml([
                makeRow({
                    totalPromissoryNoteAmount: 10000,
                    amountPaid: 3000,
                    principalPaid: 2500,
                }),
            ]);

            // Total PN: 10000, Amount Paid: 3000, Principal Paid: 2500, Balance: 7000
            expect(html).toContain('PHP 10000');
            expect(html).toContain('PHP 3000');
            expect(html).toContain('PHP 2500');
            expect(html).toContain('PHP 7000');
            expect(html).toContain('TOTAL');
        });

        it('shows correct totals in footer for multiple rows', () => {
            const rows = [
                makeRow({
                    totalPromissoryNoteAmount: 5000,
                    amountPaid: 2000,
                    principalPaid: 1500,
                    accountNumber: 'ACC-001',
                }),
                makeRow({
                    totalPromissoryNoteAmount: 3000,
                    amountPaid: 1000,
                    principalPaid: 800,
                    accountNumber: 'ACC-002',
                }),
            ];

            const html = ClientSoaMasterlistService.buildHtml(rows);

            // Totals: PN = 8000, Paid = 3000, Principal = 2300, Balance = 3000 + 2000 = 5000
            expect(html).toContain('PHP 8000');
            expect(html).toContain('PHP 3000');
            expect(html).toContain('PHP 2300');
            expect(html).toContain('PHP 5000');
            expect(html).toContain('TOTAL');
        });

        it('handles empty rows array', () => {
            const html = ClientSoaMasterlistService.buildHtml([]);

            expect(html).toContain('<h1>CLIENTS SOA MASTERLIST</h1>');
            // Totals should all be zero
            expect(html).toContain('PHP 0');
            expect(html).toContain('TOTAL');
        });

        it('generates table with SOA reference from accountNumber when no explicit ref', () => {
            const html = ClientSoaMasterlistService.buildHtml([
                makeRow({ accountNumber: 'ACC-999' }),
            ]);

            // The escapeHtml mock returns the string as-is
            expect(html).toContain('SOA_ACC-999');
        });

        it('uses explicit soaReferenceNumber when provided', () => {
            const html = ClientSoaMasterlistService.buildHtml([
                makeRow({
                    accountNumber: 'ACC-001',
                    soaReferenceNumber: 'REF-EXPLICIT',
                }),
            ]);

            expect(html).toContain('REF-EXPLICIT');
        });

        it('shows row number (S/N) starting from 1', () => {
            const html = ClientSoaMasterlistService.buildHtml([
                makeRow({ lastName: 'Alpha' }),
                makeRow({ lastName: 'Beta' }),
                makeRow({ lastName: 'Gamma' }),
            ]);

            // Each row gets an index+1 as its S/N
            expect(html).toContain('<td>1</td>');
            expect(html).toContain('<td>2</td>');
            expect(html).toContain('<td>3</td>');
        });
    });
});
