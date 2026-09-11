import { LandBankSubmissionReportService } from '../LandBankSubmissionReportService';

jest.mock('../../utils/currency', () => ({
    formatPHP: jest.fn((value: number) => `PHP ${value.toLocaleString()}`),
}));

jest.mock('../../constants/brand', () => ({
    COMPANY_NAME: 'TEST COOP',
}));

describe('LandBankSubmissionReportService', () => {
    describe('buildRowsFromBorrowers', () => {
        const sampleBorrowers = [
            { fullName: 'Juan Dela Cruz', bankAccountName: 'JUAN D. CRUZ', bankAccountNumber: '1234-5678-9' },
            { fullName: 'Maria Santos', bankAccountName: undefined, bankAccountNumber: '9876-5432-1' },
            { fullName: 'Pedro Reyes', bankAccountName: 'PEDRO REYES', bankAccountNumber: undefined },
            { fullName: 'Ana Lopez', bankAccountName: undefined, bankAccountNumber: '' },
            { fullName: 'Jose Rizal', bankAccountName: 'JOSE RIZAL', bankAccountNumber: 'ABC-1234-XYZ!@#' },
        ];

        const amountByBorrowerName: Record<string, number> = {
            'Juan Dela Cruz': 5000,
            'Maria Santos': 3000,
            'Pedro Reyes': 2000,
        };

        it('filters out borrowers without bankAccountNumber', () => {
            const rows = LandBankSubmissionReportService.buildRowsFromBorrowers(
                sampleBorrowers,
                amountByBorrowerName
            );

            // Pedro Reyes (undefined) and Ana Lopez (empty string) should be filtered out
            expect(rows).toHaveLength(3);

            const names = rows.map(r => r.accountName);
            expect(names).toContain('JUAN D. CRUZ');
            expect(names).toContain('MARIA SANTOS');
            expect(names).toContain('JOSE RIZAL');
        });

        it('normalizes account numbers (removes non-digit/dash chars)', () => {
            const rows = LandBankSubmissionReportService.buildRowsFromBorrowers(
                sampleBorrowers,
                amountByBorrowerName
            );

            // Jose Rizal has 'ABC-1234-XYZ!@#' → should become '1234-'
            // Actually normalizeAccountNumber removes non-digit/dash chars: [^\d-]
            // 'ABC-1234-XYZ!@#' → '-1234-'
            const rizal = rows.find(r => r.accountName === 'JOSE RIZAL');
            expect(rizal).toBeDefined();
            expect(rizal!.accountNumber).toBe('-1234-');

            // Juan's should stay as-is since it only has digits and dashes
            const juan = rows.find(r => r.accountName === 'JUAN D. CRUZ');
            expect(juan).toBeDefined();
            expect(juan!.accountNumber).toBe('1234-5678-9');
        });

        it('looks up amount by borrower fullName', () => {
            const rows = LandBankSubmissionReportService.buildRowsFromBorrowers(
                sampleBorrowers,
                amountByBorrowerName
            );

            const juan = rows.find(r => r.accountName === 'JUAN D. CRUZ');
            expect(juan).toBeDefined();
            expect(juan!.amount).toBe(5000);

            const maria = rows.find(r => r.accountName === 'MARIA SANTOS');
            expect(maria).toBeDefined();
            expect(maria!.amount).toBe(3000);
        });

        it('defaults amount to 0 when borrower not in amountByBorrowerName', () => {
            const rows = LandBankSubmissionReportService.buildRowsFromBorrowers(
                sampleBorrowers,
                amountByBorrowerName
            );

            const rizal = rows.find(r => r.accountName === 'JOSE RIZAL');
            expect(rizal).toBeDefined();
            expect(rizal!.amount).toBe(0);
        });

        it('sets accountName to bankAccountName when available, uppercased', () => {
            const rows = LandBankSubmissionReportService.buildRowsFromBorrowers(
                [{ fullName: 'Test User', bankAccountName: 'My Account', bankAccountNumber: '1' }],
                {}
            );

            expect(rows[0].accountName).toBe('MY ACCOUNT');
        });

        it('falls back to fullName when bankAccountName is missing, uppercased', () => {
            const rows = LandBankSubmissionReportService.buildRowsFromBorrowers(
                [{ fullName: 'Test User', bankAccountName: undefined, bankAccountNumber: '1' }],
                {}
            );

            expect(rows[0].accountName).toBe('TEST USER');
        });

        it('falls back to fullName when bankAccountName is empty string', () => {
            const rows = LandBankSubmissionReportService.buildRowsFromBorrowers(
                [{ fullName: 'Test User', bankAccountName: '', bankAccountNumber: '1' }],
                {}
            );

            expect(rows[0].accountName).toBe('TEST USER');
        });

        it('returns empty array when no borrowers have bankAccountNumber', () => {
            const rows = LandBankSubmissionReportService.buildRowsFromBorrowers(
                [{ fullName: 'No Account', bankAccountNumber: undefined }],
                {}
            );

            expect(rows).toEqual([]);
        });
    });

    describe('buildHtml', () => {
        const baseInput = {
            rows: [
                { accountNumber: '1111-2222-3', accountName: 'JUAN DELA CRUZ', amount: 5000 },
                { accountNumber: '4444-5555-6', accountName: 'MARIA SANTOS', amount: 3000 },
            ],
            reportDate: new Date('2026-06-15'),
        };

        it('contains "PAYROLL REGISTER" header', () => {
            const html = LandBankSubmissionReportService.buildHtml(baseInput);
            expect(html).toContain('<h1>PAYROLL REGISTER</h1>');
        });

        it('shows COMPANY_NAME', () => {
            const html = LandBankSubmissionReportService.buildHtml(baseInput);
            expect(html).toContain('TEST COOP');
        });

        it('shows correct total in footer', () => {
            const html = LandBankSubmissionReportService.buildHtml(baseInput);
            // Total: 5000 + 3000 = 8000
            expect(html).toContain('PHP 8,000');
            // Record count
            expect(html).toContain('TOTAL AMOUNT / RECORDS: 2');
        });

        it('handles empty rows', () => {
            const html = LandBankSubmissionReportService.buildHtml({
                ...baseInput,
                rows: [],
            });

            expect(html).toContain('PHP 0');
            expect(html).toContain('TOTAL AMOUNT / RECORDS: 0');
            // Should still have the table structure
            expect(html).toContain('<table>');
        });

        it('includes prepared/checked/noted by signatures', () => {
            const html = LandBankSubmissionReportService.buildHtml({
                ...baseInput,
                preparedBy: 'Alice',
                checkedBy: 'Bob',
                notedBy: 'Charlie',
            });

            expect(html).toContain('Alice');
            expect(html).toContain('Bob');
            expect(html).toContain('Charlie');
            expect(html).toContain('class="sig"');
        });

        it('uses default values for signatures when not provided', () => {
            const html = LandBankSubmissionReportService.buildHtml(baseInput);

            expect(html).toContain('Prepared By');
            expect(html).toContain('Checked By');
            expect(html).toContain('Noted By');
        });

        it('escapes HTML in account number and name', () => {
            const html = LandBankSubmissionReportService.buildHtml({
                ...baseInput,
                rows: [
                    { accountNumber: '<script>alert("XSS")</script>', accountName: 'TEST & CO.', amount: 100 },
                ],
            });

            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
            expect(html).not.toContain('TEST & CO.');
            expect(html).toContain('TEST &amp; CO.');
        });

        it('includes report date formatted', () => {
            const html = LandBankSubmissionReportService.buildHtml(baseInput);
            // date-fns format for 'MMMM d, yyyy' on June 15, 2026
            expect(html).toContain('June 15, 2026');
        });

        it('uses default branch and branch code when not provided', () => {
            const html = LandBankSubmissionReportService.buildHtml(baseInput);
            expect(html).toContain('LA CARLOTA BRANCH');
        });

        it('uses provided branch and branch code', () => {
            const html = LandBankSubmissionReportService.buildHtml({
                ...baseInput,
                branch: 'MAIN BRANCH',
                branchCode: '001',
            });
            expect(html).toContain('MAIN BRANCH');
            expect(html).toContain('001');
        });
    });
});
