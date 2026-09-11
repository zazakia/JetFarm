import { CreditorsGroupLifeSummaryService } from '../CreditorsGroupLifeSummaryService';

jest.mock('../../utils/loanProducts', () => ({
    loanProductLabel: jest.fn((type?: string) => type || 'standard'),
}));

jest.mock('date-fns', () => ({
    format: jest.fn((date: Date, fmt: string) => {
        if (fmt === 'd-MMM-yyyy') {
            const d = new Date(date);
            return `${d.getDate()}-Jan-${d.getFullYear()}`;
        }
        return String(date);
    }),
}));

jest.mock('../reportFormatters', () => ({
    escapeHtml: jest.fn((value: unknown) => {
        if (value == null) return '';
        return String(value);
    }),
}));

// ── Test helpers ──────────────────────────────────────────────

const makeLoan = (overrides: Record<string, unknown> = {}) => ({
    loanNumber: 'LN-001',
    loanType: 'petty_cash',
    principalAmount: 5000,
    term: 6,
    termUnit: 'months',
    releaseDate: new Date('2026-01-15'),
    firstPaymentDate: new Date('2026-02-01'),
    insuranceAmount: 100,
    ...overrides,
});

const makeBorrower = (overrides: Record<string, unknown> = {}) => ({
    fullName: 'Juan Dela Cruz',
    dateOfBirth: new Date('1990-05-20'),
    gender: 'male',
    ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────

describe('CreditorsGroupLifeSummaryService', () => {
    // ── isEligibleLoanType ──────────────────────────────────

    describe('isEligibleLoanType', () => {
        it('returns true for petty_cash', () => {
            expect(CreditorsGroupLifeSummaryService.isEligibleLoanType('petty_cash')).toBe(true);
        });

        it('returns true for livelihood', () => {
            expect(CreditorsGroupLifeSummaryService.isEligibleLoanType('livelihood')).toBe(true);
        });

        it('returns true for salary', () => {
            expect(CreditorsGroupLifeSummaryService.isEligibleLoanType('salary')).toBe(true);
        });

        it('returns true for emergency', () => {
            expect(CreditorsGroupLifeSummaryService.isEligibleLoanType('emergency')).toBe(true);
        });

        it('returns false for standard (not eligible)', () => {
            expect(CreditorsGroupLifeSummaryService.isEligibleLoanType('standard')).toBe(false);
        });

        it('returns false for undefined', () => {
            expect(CreditorsGroupLifeSummaryService.isEligibleLoanType(undefined)).toBe(false);
        });

        it('returns false for arbitrary strings', () => {
            expect(CreditorsGroupLifeSummaryService.isEligibleLoanType('business')).toBe(false);
            expect(CreditorsGroupLifeSummaryService.isEligibleLoanType('')).toBe(false);
        });
    });

    // ── splitName (via buildRow) ────────────────────────────

    describe('splitName', () => {
        const buildRowWithName = (
            fullName?: string,
            firstName?: string,
            lastName?: string,
        ) => {
            const loan = makeLoan();
            const borrower = makeBorrower({ fullName, firstName, lastName });
            return CreditorsGroupLifeSummaryService.buildRow(loan, borrower, 1);
        };

        it('parses "First Last" into firstName and lastName', () => {
            const row = buildRowWithName('John Doe');
            expect(row.firstName).toBe('JOHN');
            expect(row.lastName).toBe('DOE');
            expect(row.middleInitial).toBe('');
        });

        it('handles single name only', () => {
            const row = buildRowWithName('Madonna');
            expect(row.firstName).toBe('MADONNA');
            expect(row.lastName).toBe('');
            expect(row.middleInitial).toBe('');
        });

        it('returns empty strings for empty/null fullName', () => {
            const row = buildRowWithName('');
            expect(row.firstName).toBe('');
            expect(row.lastName).toBe('');
            expect(row.middleInitial).toBe('');
        });

        it('uses explicit firstName/lastName and ignores fullName', () => {
            const loan = makeLoan();
            const borrower = makeBorrower({
                fullName: 'Ignored Name',
                firstName: 'Anna',
                lastName: 'Reyes',
            });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, borrower, 1);
            expect(row.firstName).toBe('ANNA');
            expect(row.lastName).toBe('REYES');
        });

        it('handles compound surname prefix DE', () => {
            const row = buildRowWithName('Jose P. De Leon');
            expect(row.lastName).toBe('DE LEON');
            expect(row.firstName).toBe('JOSE');
            expect(row.middleInitial).toBe('P');
        });

        it('handles compound surname prefix DEL', () => {
            const row = buildRowWithName('Maria Clara Del Pilar');
            expect(row.lastName).toBe('DEL PILAR');
            expect(row.firstName).toBe('MARIA CLARA');
            expect(row.middleInitial).toBe('');
        });

        it('handles compound surname prefix DELA', () => {
            const row = buildRowWithName('Juan A. Dela Cruz');
            expect(row.lastName).toBe('DELA CRUZ');
            expect(row.firstName).toBe('JUAN');
            expect(row.middleInitial).toBe('A');
        });

        it('handles compound surname prefix VAN', () => {
            const row = buildRowWithName('Anna Marie Van Trapp');
            expect(row.lastName).toBe('VAN TRAPP');
            expect(row.firstName).toBe('ANNA MARIE');
            expect(row.middleInitial).toBe('');
        });

        it('handles compound surname prefix VON', () => {
            const row = buildRowWithName('Ludwig Von Beethoven');
            expect(row.lastName).toBe('VON BEETHOVEN');
            expect(row.firstName).toBe('LUDWIG');
        });

        it('treats DE as prefix even when written in lowercase', () => {
            const row = buildRowWithName('Carlos de Silva');
            expect(row.lastName).toBe('DE SILVA');
            expect(row.firstName).toBe('CARLOS');
        });

        it('extracts middle initial when single letter followed by period', () => {
            const row = buildRowWithName('Roberto N. Gonzales');
            expect(row.middleInitial).toBe('N');
            expect(row.firstName).toBe('ROBERTO');
            expect(row.lastName).toBe('GONZALES');
        });

        it('extracts middle initial when single letter without period', () => {
            const row = buildRowWithName('Roberto N Gonzales');
            expect(row.middleInitial).toBe('N');
            expect(row.firstName).toBe('ROBERTO');
        });

        it('does NOT extract middle initial for multi-letter middle names', () => {
            const row = buildRowWithName('Maria Clara Santos');
            expect(row.middleInitial).toBe('');
            expect(row.firstName).toBe('MARIA CLARA');
            expect(row.lastName).toBe('SANTOS');
        });

        it('handles three-part name without compound prefix (last word is surname)', () => {
            const row = buildRowWithName('Juan Miguel Reyes');
            expect(row.lastName).toBe('REYES');
            expect(row.firstName).toBe('JUAN MIGUEL');
            expect(row.middleInitial).toBe('');
        });

        it('handles compound prefix where middle name part happens to be a prefix-like word', () => {
            // "Del" is NOT a prefix when it's the first part; only when at parts[length-2]
            const row = buildRowWithName('Del Santos');
            expect(row.lastName).toBe('SANTOS');
            expect(row.firstName).toBe('DEL');
        });

        it('handles extra whitespace in fullName', () => {
            const row = buildRowWithName('  Juan   Dela   Cruz  ');
            expect(row.lastName).toBe('DELA CRUZ');
            expect(row.firstName).toBe('JUAN');
        });
    });

    // ── buildRow ────────────────────────────────────────────

    describe('buildRow', () => {
        it('creates proper summary row with all fields', () => {
            const loan = makeLoan();
            const borrower = makeBorrower({ fullName: 'Juan Dela Cruz', gender: 'male' });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, borrower, 5);

            expect(row.voucherNumber).toBe(5);
            expect(row.lastName).toBe('DELA CRUZ');
            expect(row.firstName).toBe('JUAN');
            expect(row.middleInitial).toBe('');
            expect(row.sex).toBe('M');
            expect(row.dateOfBirth).toBe('20-Jan-1990');
            expect(row.effectiveDate).toBe('1-Jan-2026'); // firstPaymentDate takes precedence
            expect(row.civilStatus).toBe('');
            expect(row.amountOfLoan).toBe(5000);
            expect(row.typeOfLoan).toBe('PETTY_CASH');
            expect(row.termMonths).toBe(6);
        });

        it('computes annualNetPremiumPaid from insuranceAmount', () => {
            const loan = makeLoan({ insuranceAmount: 250.50 });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, makeBorrower(), 1);
            expect(row.annualNetPremiumPaid).toBe(250.50);
        });

        it('computes serviceFee as percent of annualNetPremiumPaid', () => {
            const loan = makeLoan({ insuranceAmount: 100 });
            // Default serviceFeePercent = 10 → serviceFee = roundCurrency(100 * 0.10) = 10
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, makeBorrower(), 1);
            expect(row.serviceFee).toBe(10);
        });

        it('computes annualGrossPremiumPaid as net + serviceFee', () => {
            const loan = makeLoan({ insuranceAmount: 100 });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, makeBorrower(), 1);
            expect(row.annualGrossPremiumPaid).toBe(110);
        });

        it('accepts custom serviceFeePercent', () => {
            const loan = makeLoan({ insuranceAmount: 200 });
            // serviceFeePercent = 12 → serviceFee = roundCurrency(200 * 0.12) = 24
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, makeBorrower(), 1, 12);
            expect(row.serviceFee).toBe(24);
            expect(row.annualGrossPremiumPaid).toBe(224);
        });

        it('defaults insuranceAmount to 0 when missing', () => {
            const loan = makeLoan({ insuranceAmount: undefined });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, makeBorrower(), 1);
            expect(row.annualNetPremiumPaid).toBe(0);
            expect(row.serviceFee).toBe(0);
            expect(row.annualGrossPremiumPaid).toBe(0);
        });

        it('defaults principalAmount to 0 when 0 or missing', () => {
            const loan = makeLoan({ principalAmount: 0 });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, makeBorrower(), 1);
            expect(row.amountOfLoan).toBe(0);
        });

        it('uses releaseDate as effectiveDate when firstPaymentDate is missing', () => {
            const loan = makeLoan({
                firstPaymentDate: undefined,
                releaseDate: new Date('2026-03-10'),
            });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, makeBorrower(), 1);
            expect(row.effectiveDate).toBe('10-Jan-2026');
        });

        it('rounds currency values to 2 decimal places', () => {
            const loan = makeLoan({ insuranceAmount: 99.995 });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, makeBorrower(), 1);
            // 99.995 rounds to 100.00
            expect(row.annualNetPremiumPaid).toBe(100);
        });

        it('determines sex as F for female gender', () => {
            const loan = makeLoan();
            const borrower = makeBorrower({ fullName: 'Maria Santos', gender: 'female' });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, borrower, 1);
            expect(row.sex).toBe('F');
        });

        it('determines sex as empty for unknown gender', () => {
            const loan = makeLoan();
            const borrower = makeBorrower({ fullName: 'Alex Cruz', gender: undefined });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, borrower, 1);
            expect(row.sex).toBe('');
        });

        it('computes termMonths from days term unit', () => {
            const loan = makeLoan({ term: 45, termUnit: 'days' });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, makeBorrower(), 1);
            // ceil(45/30) = ceil(1.5) = 2
            expect(row.termMonths).toBe(2);
        });

        it('computes termMonths for short days (minimum 1)', () => {
            const loan = makeLoan({ term: 5, termUnit: 'days' });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, makeBorrower(), 1);
            // max(1, ceil(5/30)) = max(1, 1) = 1
            expect(row.termMonths).toBe(1);
        });

        it('returns 0 termMonths for invalid term', () => {
            const loan = makeLoan({ term: 0, termUnit: 'months' });
            const row = CreditorsGroupLifeSummaryService.buildRow(loan, makeBorrower(), 1);
            expect(row.termMonths).toBe(0);
        });
    });

    // ── buildRows ───────────────────────────────────────────

    describe('buildRows', () => {
        const makeRecord = (
            loanType: string,
            fullName: string,
            insuranceAmount = 100,
        ) => ({
            loan: makeLoan({ loanType, insuranceAmount }),
            borrower: makeBorrower({ fullName }),
        });

        it('filters out ineligible loan types', () => {
            const records = [
                makeRecord('petty_cash', 'Juan Cruz'),
                makeRecord('standard', 'Maria Reyes'),       // ineligible
                makeRecord('livelihood', 'Jose Santos'),
                makeRecord('business', 'Anna Gomez'),         // ineligible
                makeRecord('salary', 'Pedro Luna'),
                makeRecord('emergency', 'Rosa Vega'),
            ];

            const rows = CreditorsGroupLifeSummaryService.buildRows(records);
            expect(rows.length).toBe(4);
            expect(rows[0].lastName).toBe('CRUZ');
            expect(rows[1].lastName).toBe('SANTOS');
            expect(rows[2].lastName).toBe('LUNA');
            expect(rows[3].lastName).toBe('VEGA');
        });

        it('assigns incremental voucher numbers starting at 1', () => {
            const records = [
                makeRecord('petty_cash', 'A Borrower'),
                makeRecord('livelihood', 'B Borrower'),
                makeRecord('salary', 'C Borrower'),
            ];

            const rows = CreditorsGroupLifeSummaryService.buildRows(records);
            expect(rows[0].voucherNumber).toBe(1);
            expect(rows[1].voucherNumber).toBe(2);
            expect(rows[2].voucherNumber).toBe(3);
        });

        it('voucher numbers skip filtered-out records', () => {
            const records = [
                makeRecord('standard', 'Skip Me'),          // filtered out
                makeRecord('petty_cash', 'First Eligible'),
                makeRecord('standard', 'Skip Me Too'),      // filtered out
                makeRecord('salary', 'Second Eligible'),
            ];

            const rows = CreditorsGroupLifeSummaryService.buildRows(records);
            expect(rows.length).toBe(2);
            expect(rows[0].voucherNumber).toBe(1);
            expect(rows[0].lastName).toBe('ELIGIBLE');
            expect(rows[1].voucherNumber).toBe(2);
            expect(rows[1].lastName).toBe('ELIGIBLE');
        });

        it('passes serviceFeePercent to buildRow', () => {
            const records = [
                makeRecord('petty_cash', 'Juan Cruz', 200),
            ];

            const rows = CreditorsGroupLifeSummaryService.buildRows(records, 15);
            // serviceFee = roundCurrency(200 * 0.15) = 30
            expect(rows[0].serviceFee).toBe(30);
            expect(rows[0].annualGrossPremiumPaid).toBe(230);
        });

        it('returns empty array for empty input', () => {
            const rows = CreditorsGroupLifeSummaryService.buildRows([]);
            expect(rows).toEqual([]);
        });

        it('returns empty array when all records are ineligible', () => {
            const records = [
                makeRecord('standard', 'A Person'),
                makeRecord('business', 'B Person'),
            ];
            const rows = CreditorsGroupLifeSummaryService.buildRows(records);
            expect(rows).toEqual([]);
        });
    });

    // ── totals ─────────────────────────────────────────────

    describe('totals', () => {
        const makeRow = (overrides: Partial<Record<string, number>> = {}) => ({
            voucherNumber: 1,
            lastName: '',
            firstName: '',
            middleInitial: '',
            sex: '',
            dateOfBirth: '',
            effectiveDate: '',
            civilStatus: '',
            amountOfLoan: 0,
            typeOfLoan: '',
            termMonths: 0,
            approvedTermMonths: '',
            annualNetPremiumPaid: 0,
            serviceFee: 0,
            annualGrossPremiumPaid: 0,
            ...overrides,
        });

        it('aggregates amountOfLoan across rows', () => {
            const rows = [
                makeRow({ amountOfLoan: 1000 }),
                makeRow({ amountOfLoan: 2000 }),
                makeRow({ amountOfLoan: 3000 }),
            ];
            const result = CreditorsGroupLifeSummaryService.totals(rows);
            expect(result.amountOfLoan).toBe(6000);
        });

        it('aggregates annualNetPremiumPaid across rows', () => {
            const rows = [
                makeRow({ annualNetPremiumPaid: 50 }),
                makeRow({ annualNetPremiumPaid: 75 }),
            ];
            const result = CreditorsGroupLifeSummaryService.totals(rows);
            expect(result.annualNetPremiumPaid).toBe(125);
        });

        it('aggregates serviceFee across rows', () => {
            const rows = [
                makeRow({ serviceFee: 10 }),
                makeRow({ serviceFee: 20 }),
            ];
            const result = CreditorsGroupLifeSummaryService.totals(rows);
            expect(result.serviceFee).toBe(30);
        });

        it('aggregates annualGrossPremiumPaid across rows', () => {
            const rows = [
                makeRow({ annualGrossPremiumPaid: 110 }),
                makeRow({ annualGrossPremiumPaid: 220 }),
            ];
            const result = CreditorsGroupLifeSummaryService.totals(rows);
            expect(result.annualGrossPremiumPaid).toBe(330);
        });

        it('aggregates all four columns together', () => {
            const rows = [
                makeRow({
                    amountOfLoan: 5000,
                    annualNetPremiumPaid: 100,
                    serviceFee: 10,
                    annualGrossPremiumPaid: 110,
                }),
                makeRow({
                    amountOfLoan: 3000,
                    annualNetPremiumPaid: 60,
                    serviceFee: 6,
                    annualGrossPremiumPaid: 66,
                }),
            ];
            const result = CreditorsGroupLifeSummaryService.totals(rows);
            expect(result.amountOfLoan).toBe(8000);
            expect(result.annualNetPremiumPaid).toBe(160);
            expect(result.serviceFee).toBe(16);
            expect(result.annualGrossPremiumPaid).toBe(176);
        });

        it('returns zeros for empty rows', () => {
            const result = CreditorsGroupLifeSummaryService.totals([]);
            expect(result).toEqual({
                amountOfLoan: 0,
                annualNetPremiumPaid: 0,
                serviceFee: 0,
                annualGrossPremiumPaid: 0,
            });
        });

        it('rounds aggregated values to 2 decimal places (per-step rounding)', () => {
            // roundCurrency is called after each addition, so intermediate values are already rounded:
            // step 1: roundCurrency(0 + 33.333) = 33.33
            // step 2: roundCurrency(33.33 + 33.333) = roundCurrency(66.663) = 66.66
            // step 3: roundCurrency(66.66 + 33.334) = roundCurrency(99.994) = 99.99
            const rows = [
                makeRow({ annualNetPremiumPaid: 33.333 }),
                makeRow({ annualNetPremiumPaid: 33.333 }),
                makeRow({ annualNetPremiumPaid: 33.334 }),
            ];
            const result = CreditorsGroupLifeSummaryService.totals(rows);
            expect(result.annualNetPremiumPaid).toBe(99.99);
        });
    });

    // ── buildHtml ──────────────────────────────────────────

    describe('buildHtml', () => {
        const makeSummaryRow = (
            overrides: Partial<Record<string, unknown>> = {},
        ) => ({
            voucherNumber: 1,
            lastName: 'CRUZ',
            firstName: 'JUAN',
            middleInitial: 'D',
            sex: 'M',
            dateOfBirth: '20-May-1990',
            effectiveDate: '1-Feb-2026',
            civilStatus: 'Single',
            amountOfLoan: 5000,
            typeOfLoan: 'PETTY_CASH',
            termMonths: 6,
            approvedTermMonths: '6',
            annualNetPremiumPaid: 100,
            serviceFee: 10,
            annualGrossPremiumPaid: 110,
            ...overrides,
        });

        it('contains the expected header columns', () => {
            const html = CreditorsGroupLifeSummaryService.buildHtml({
                rows: [makeSummaryRow()],
            });

            expect(html).toContain('Voucher Number');
            expect(html).toContain('Last Name');
            expect(html).toContain('First Name');
            expect(html).toContain('M.I.');
            expect(html).toContain('Sex');
            expect(html).toContain('Date of Birth');
            expect(html).toContain('Effective Date');
            expect(html).toContain('Civil Status');
            expect(html).toContain('Amount of Loan');
            expect(html).toContain('Type of Loan');
            expect(html).toContain('Term of Loan');
            expect(html).toContain('Annual Net Premium Paid');
            expect(html).toContain('Service Fee');
            expect(html).toContain('Annual Gross Premium Paid');
        });

        it('shows correct totals in the footer', () => {
            const rows = [
                makeSummaryRow({ voucherNumber: 1, amountOfLoan: 1000, annualNetPremiumPaid: 50, serviceFee: 5, annualGrossPremiumPaid: 55 }),
                makeSummaryRow({ voucherNumber: 2, amountOfLoan: 2000, annualNetPremiumPaid: 100, serviceFee: 10, annualGrossPremiumPaid: 110 }),
            ];

            const html = CreditorsGroupLifeSummaryService.buildHtml({ rows });

            // Footer should contain TOTAL row
            expect(html).toContain('TOTAL');
            // Check that it's a tfoot
            expect(html).toContain('<tfoot>');
            expect(html).toContain('</tfoot>');
        });

        it('fills empty rows to minimum 12 when fewer rows provided', () => {
            const rows = [makeSummaryRow(), makeSummaryRow(), makeSummaryRow()]; // 3 rows

            const html = CreditorsGroupLifeSummaryService.buildHtml({ rows });

            // Should have 12 tr elements in tbody (3 data + 9 empty)
            // Check that voucher numbers for empty rows start after data rows
            expect(html).toContain('>4<');  // first empty row voucher number
            expect(html).toContain('>12<'); // last empty row voucher number
        });

        it('does not add empty rows when already 12 or more', () => {
            const rows = Array.from({ length: 12 }, (_, i) =>
                makeSummaryRow({ voucherNumber: i + 1 }),
            );

            const html = CreditorsGroupLifeSummaryService.buildHtml({ rows });

            // Should NOT have voucher number 13
            expect(html).not.toContain('>13<');
        });

        it('does not add empty rows when more than 12 rows', () => {
            const rows = Array.from({ length: 15 }, (_, i) =>
                makeSummaryRow({ voucherNumber: i + 1 }),
            );

            const html = CreditorsGroupLifeSummaryService.buildHtml({ rows });

            // Should NOT have voucher number 16 in empty row section
            // Math.max(0, 12 - 15) = 0, so no empty rows
            expect(html).not.toContain('>16<');
        });

        it('uses default title "SUMMARY SHEET" when none provided', () => {
            const html = CreditorsGroupLifeSummaryService.buildHtml({
                rows: [makeSummaryRow()],
            });

            expect(html).toContain('<h1>SUMMARY SHEET</h1>');
        });

        it('uses custom title when provided', () => {
            const html = CreditorsGroupLifeSummaryService.buildHtml({
                rows: [makeSummaryRow()],
                title: 'CUSTOM REPORT TITLE',
            });

            expect(html).toContain('<h1>CUSTOM REPORT TITLE</h1>');
        });

        it('shows service fee percent in header', () => {
            const html = CreditorsGroupLifeSummaryService.buildHtml({
                rows: [makeSummaryRow()],
                serviceFeePercent: 12.5,
            });

            expect(html).toContain('12.50');
            expect(html).toContain('Service Fee:');
            expect(html).toContain('Percent (%)');
        });

        it('uses default service fee percent of 10 when not provided', () => {
            const html = CreditorsGroupLifeSummaryService.buildHtml({
                rows: [makeSummaryRow()],
            });

            expect(html).toContain('10.00');
        });

        it('handles empty rows array (no data, all empty)', () => {
            const html = CreditorsGroupLifeSummaryService.buildHtml({ rows: [] });

            // Should still have structure
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<table>');
            // Should have 12 empty rows
            expect(html).toContain('>12<');
        });

        it('produces valid HTML structure', () => {
            const html = CreditorsGroupLifeSummaryService.buildHtml({
                rows: [makeSummaryRow()],
            });

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toMatch(/<html>/);
            expect(html).toContain('<head>');
            expect(html).toContain('<body>');
            expect(html).toContain('<thead>');
            expect(html).toContain('<tbody>');
        });

        it('includes CSS styles', () => {
            const html = CreditorsGroupLifeSummaryService.buildHtml({
                rows: [makeSummaryRow()],
            });

            expect(html).toContain('<style>');
            expect(html).toContain('@page');
            expect(html).toContain('font-family');
        });
    });
});
