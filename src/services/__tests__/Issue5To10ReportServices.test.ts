import { LandBankSubmissionReportService } from '../LandBankSubmissionReportService';
import { ExpenseReportService } from '../ExpenseReportService';
import { MonthlySalesReportService } from '../MonthlySalesReportService';
import { ClientSoaMasterlistService } from '../ClientSoaMasterlistService';
import { CashAdvanceReportService } from '../CashAdvanceReportService';
import { CreditorsGroupLifeSummaryService } from '../CreditorsGroupLifeSummaryService';
import { COMPANY_NAME } from '../../constants/brand';

jest.mock('../../utils/currency', () => ({
    formatPHP: jest.fn((value) => `PHP ${value}`),
}));

describe('issue #5-#10 report services', () => {
    it('builds Land Bank payroll register rows and totals', () => {
        const rows = LandBankSubmissionReportService.buildRowsFromBorrowers([
            { fullName: 'Rey Alianza', bankAccountNumber: '4656-0957-55' },
            { fullName: 'No Bank' },
        ] as any, { 'Rey Alianza': 2240 });

        expect(rows).toEqual([{ accountNumber: '4656-0957-55', accountName: 'REY ALIANZA', amount: 2240 }]);
        const html = LandBankSubmissionReportService.buildHtml({ rows, reportDate: new Date('2026-02-12') });
        expect(html).toContain('PAYROLL REGISTER');
        expect(html).toContain('4656-0957-55');
        expect(html).toContain('TOTAL AMOUNT / RECORDS: 1');
    });

    it('builds expense report with VAT and non-VAT rows', () => {
        expect(ExpenseReportService.inferVatAmount(1000, '123-456')).toBe(0);
        expect(ExpenseReportService.inferVatAmount(1000, '123 (NON-VAT)')).toBe(0);
        const html = ExpenseReportService.buildHtml([
            { expenseDate: new Date('2025-01-01'), payee: 'PRINCE HYPERMART', tin: '273', description: 'OFFICE SUPPLIES', invoiceNumber: '0196164', amount: 620.27 },
        ], new Date('2025-01-01'));
        expect(html).toContain(`${COMPANY_NAME} EXPENSES`);
        expect(html).not.toContain('VAT (12%)');
        expect(html).toContain('PRINCE HYPERMART');
    });

    it('totals monthly sales sample columns and builds html', () => {
        const totals = MonthlySalesReportService.totals([
            { dueDate: 1, customerName: 'A', accountNumber: 'DC-1', amountPaid: 100, principal: 70, interest: 20, vat: 2, unclaimedRebates: 1 },
            { dueDate: 1, customerName: 'B', accountNumber: 'DC-2', amountPaid: 50, principal: 30, interest: 15, vat: 1.8 },
            { dueDate: 1, customerName: 'C', accountNumber: 'DC-3', amountPaid: undefined as any, principal: undefined as any, interest: undefined as any, vat: undefined as any, unclaimedRebates: undefined as any }
        ]);
        expect(totals).toEqual({ amountPaid: 150, principal: 100, interest: 35, vat: 3.8, unclaimedRebates: 1 });
        
        const rowsForHtml = [
            { dueDate: 1, customerName: 'A', accountNumber: 'DC-1', amountPaid: 100, principal: 70, interest: 20, vat: 2, unclaimedRebates: 1, establishment: 'Est A', status: 'Active' },
            { dueDate: 1, customerName: 'B', accountNumber: 'DC-2', amountPaid: 50, principal: 30, interest: 15, vat: 1.8 }
        ];
        const html = MonthlySalesReportService.buildHtml(rowsForHtml, new Date('2026-01-01'));
        expect(html).toContain('MONTHLY COLLECTIONS');
        expect(html).toContain('Est A');
        expect(html).toContain('Active');
    });

    it('builds client SOA masterlist balances', () => {
        const row = { lastName: 'ABALO', firstName: 'REYMART', accountNumber: 'DC-2023-11-001', totalPromissoryNoteAmount: 27600, amountPaid: 23150, principalPaid: 16666.65 };
        expect(ClientSoaMasterlistService.balance(row)).toBe(4450);
        expect(ClientSoaMasterlistService.buildHtml([row])).toContain('CLIENTS SOA MASTERLIST');
    });

    it('builds cash advance report totals', () => {
        const row = { clientNumber: 'DC-2025-08-013', clientName: 'YSAR HILARIO', termsInMonths: 1, ratePerMonth: 0.05, cashAmount: 2000 };
        expect(CashAdvanceReportService.totalAdvance(row)).toBe(2000);
        expect(CashAdvanceReportService.buildHtml([row])).toContain('CASH ADVANCES');
    });

    it('builds creditors group life summary rows for salary and emergency loans only', () => {
        const rows = CreditorsGroupLifeSummaryService.buildRows([
            {
                borrower: { fullName: 'MICHAEL JOHN C. DE JESUS', gender: 'Male', dateOfBirth: new Date('1982-04-18') },
                loan: {
                    loanNumber: 'SL-001',
                    loanType: 'salary',
                    principalAmount: 23011,
                    term: 18,
                    termUnit: 'months',
                    firstPaymentDate: new Date('2026-04-14'),
                    insuranceAmount: 251.95,
                },
            },
            {
                borrower: { firstName: 'KATRINA', lastName: 'JALANDONI', gender: 'Female' },
                loan: {
                    loanNumber: 'TU-001',
                    loanType: 'emergency',
                    principalAmount: 59787,
                    term: 36,
                    termUnit: 'months',
                    releaseDate: new Date('2026-04-27'),
                    insuranceAmount: 1205.31,
                },
            },
            {
                borrower: { fullName: 'Standard Borrower' },
                loan: {
                    loanNumber: 'STD-001',
                    loanType: 'standard',
                    principalAmount: 1000,
                    term: 1,
                    termUnit: 'months',
                    insuranceAmount: 10,
                },
            },
        ]);

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            voucherNumber: 1,
            lastName: 'DE JESUS',
            firstName: 'MICHAEL JOHN',
            middleInitial: 'C',
            sex: 'M',
            dateOfBirth: '18-Apr-1982',
            effectiveDate: '14-Apr-2026',
            annualNetPremiumPaid: 251.95,
            serviceFee: 25.2,
            annualGrossPremiumPaid: 277.15,
        });
        expect(rows[1].typeOfLoan).toBe('EMERGENCY LOAN');

        const html = CreditorsGroupLifeSummaryService.buildHtml({ rows });
        expect(html).toContain('SUMMARY SHEET');
        expect(html).toContain('Creditors Group Life Insurance');
        expect(html).toContain('EMERGENCY LOAN');
        expect(html).toContain('10.00');
    });
});
