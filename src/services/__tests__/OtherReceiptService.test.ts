import { createTestDatabase } from '../../__tests__/test-utils';
import { OtherReceiptServiceClass } from '../OtherReceiptService';
import { Q } from '@nozbe/watermelondb';

import { ChartOfAccountsServiceClass } from '../ChartOfAccountsService';

describe('OtherReceiptService', () => {
    let db: any;
    let service: OtherReceiptServiceClass;

    beforeEach(async () => {
        db = createTestDatabase();
        const coaService = new ChartOfAccountsServiceClass(db);
        await coaService.seed();
        service = new OtherReceiptServiceClass(db);
    });

    describe('Validation', () => {
        it('throws error if payor name is empty', async () => {
            await expect(service.createReceipt({
                payorName: '',
                category: 'service_charge',
                amount: 500,
            })).rejects.toThrow('Payor name is required');
        });

        it('throws error if amount is zero or negative', async () => {
            await expect(service.createReceipt({
                payorName: 'Juan Dela Cruz',
                category: 'service_charge',
                amount: 0,
            })).rejects.toThrow('Amount must be a positive number');

            await expect(service.createReceipt({
                payorName: 'Juan Dela Cruz',
                category: 'service_charge',
                amount: -100,
            })).rejects.toThrow('Amount must be a positive number');
        });
    });

    describe('Receipt Creation & Auto-Posting', () => {
        it('creates a cash transaction and posts double entry for service charge', async () => {
            const receipt = await service.createReceipt({
                payorName: 'Juan Dela Cruz',
                category: 'service_charge',
                amount: 250,
                receiptNumber: 'OR-1001',
                notes: 'Loan processing fee charge',
            });

            expect(receipt.id).toBeDefined();
            expect(receipt.receiptNumber).toBe('OR-1001');
            expect(receipt.payorName).toBe('Juan Dela Cruz');
            expect(receipt.amount).toBe(250);
            expect(receipt.category).toBe('service_charge');
            expect(receipt.categoryLabel).toBe('Service Charge');

            // Verify CashTransaction in DB
            const cashTxns = await db.get('cash_transactions').query().fetch();
            expect(cashTxns.length).toBe(1);
            expect(cashTxns[0].amount).toBe(250);
            expect(cashTxns[0].type).toBe('in');
            expect(cashTxns[0].particulars).toContain('OR# OR-1001');
            expect(cashTxns[0].particulars).toContain('Juan Dela Cruz');

            // Verify JournalEntry in DB (Debit 1010 Cash on Hand / Credit 4020 Service Charges)
            const journals = await db.get('journal_entries').query().fetch();
            expect(journals.length).toBe(1);
            const lines = await db.get('journal_entry_lines').query(Q.where('journal_entry_id', journals[0].id)).fetch();
            expect(lines.length).toBe(2);

            const debitLine = lines.find((l: any) => l.debitAmount > 0);
            const creditLine = lines.find((l: any) => l.creditAmount > 0);

            expect(debitLine.accountCode).toBe('1010'); // Cash on Hand
            expect(debitLine.debitAmount).toBe(250);
            expect(creditLine.accountCode).toBe('4020'); // Service Charges
            expect(creditLine.creditAmount).toBe(250);
        });

        it('creates bank transaction and debits Cash in Bank when paymentMethod is bank', async () => {
            const receipt = await service.createReceipt({
                payorName: 'Maria Santos',
                category: 'membership_fee',
                amount: 500,
                paymentMethod: 'bank',
                bankAccountId: 'bank-acc-1',
            });

            expect(receipt.paymentMethod).toBe('bank');

            // Verify BankTransaction in DB
            const bankTxns = await db.get('bank_transactions').query().fetch();
            expect(bankTxns.length).toBe(1);
            expect(bankTxns[0].type).toBe('deposit');
            expect(bankTxns[0].amount).toBe(500);

            // Verify JournalEntry (Debit 1020 Cash in Bank / Credit 4030 Membership Fees)
            const journals = await db.get('journal_entries').query().fetch();
            const lines = await db.get('journal_entry_lines').query(Q.where('journal_entry_id', journals[0].id)).fetch();
            const debitLine = lines.find((l: any) => l.debitAmount > 0);
            const creditLine = lines.find((l: any) => l.creditAmount > 0);

            expect(debitLine.accountCode).toBe('1020');
            expect(creditLine.accountCode).toBe('4030');
        });

        it('correctly maps various fee categories to accounting accounts', async () => {
            // Passbook Fee -> 4070 Misc Income
            await service.createReceipt({
                payorName: 'Pedro Penduko',
                category: 'passbook_fee',
                amount: 150,
            });

            // Share Capital -> 3010 Share Capital
            await service.createReceipt({
                payorName: 'Clara Del Prado',
                category: 'share_capital',
                amount: 2000,
            });

            const journals = await db.get('journal_entries').query().fetch();
            expect(journals.length).toBe(2);

            const allLines = await db.get('journal_entry_lines').query().fetch();
            const passbookCredit = allLines.find((l: any) => l.creditAmount === 150);
            const shareCredit = allLines.find((l: any) => l.creditAmount === 2000);

            expect(passbookCredit.accountCode).toBe('4070');
            expect(shareCredit.accountCode).toBe('3010');
        });
    });

    describe('Receipt Queries & Summary Reports', () => {
        it('calculates daily, monthly, and yearly summaries accurately', async () => {
            const date1 = new Date(2026, 7, 10, 10, 0, 0); // Aug 10, 2026
            const date2 = new Date(2026, 7, 10, 14, 0, 0); // Aug 10, 2026
            const date3 = new Date(2026, 7, 15, 9, 0, 0);  // Aug 15, 2026

            await service.createReceipt({
                payorName: 'Payor 1',
                category: 'service_charge',
                amount: 300,
                transactionDate: date1,
            });

            await service.createReceipt({
                payorName: 'Payor 2',
                category: 'membership_fee',
                amount: 500,
                paymentMethod: 'bank',
                bankAccountId: 'bank-1',
                transactionDate: date2,
            });

            await service.createReceipt({
                payorName: 'Payor 3',
                category: 'service_charge',
                amount: 400,
                transactionDate: date3,
            });

            // Daily summary for Aug 10
            const daily = await service.getReceiptSummary({
                period: 'daily',
                date: date1,
            });

            expect(daily.totalAmount).toBe(800); // 300 + 500
            expect(daily.receiptCount).toBe(2);
            expect(daily.averageAmount).toBe(400);
            expect(daily.paymentMethodBreakdown.cash).toBe(300);
            expect(daily.paymentMethodBreakdown.bank).toBe(500);

            // Monthly summary for August 2026
            const monthly = await service.getReceiptSummary({
                period: 'monthly',
                date: date1,
            });

            expect(monthly.totalAmount).toBe(1200); // 300 + 500 + 400
            expect(monthly.receiptCount).toBe(3);
            expect(monthly.averageAmount).toBe(400);

            const serviceBreakdown = monthly.categoryBreakdown.find(b => b.category === 'service_charge');
            expect(serviceBreakdown?.amount).toBe(700);
            expect(serviceBreakdown?.count).toBe(2);

            // Yearly summary for 2026
            const yearly = await service.getReceiptSummary({
                period: 'yearly',
                date: date1,
            });

            expect(yearly.totalAmount).toBe(1200);
            expect(yearly.receiptCount).toBe(3);
        });

        it('filters receipts by search query', async () => {
            await service.createReceipt({
                payorName: 'Alice Guo',
                category: 'service_charge',
                amount: 100,
                receiptNumber: 'OR-SPECIAL-99',
            });

            await service.createReceipt({
                payorName: 'Bob Builder',
                category: 'membership_fee',
                amount: 200,
                receiptNumber: 'OR-STD-01',
            });

            const searchByName = await service.getReceipts({ search: 'Alice' });
            expect(searchByName.length).toBe(1);
            expect(searchByName[0].payorName).toBe('Alice Guo');

            const searchByOR = await service.getReceipts({ search: 'SPECIAL-99' });
            expect(searchByOR.length).toBe(1);
            expect(searchByOR[0].payorName).toBe('Alice Guo');
        });
    });
});
