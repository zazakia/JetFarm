import { Database, Q } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase, createTestData } from '../../__tests__/test-utils';
import { PaymentService } from '../PaymentService';
import Loan from '../../database/models/Loan';
import Payment from '../../database/models/Payment';
import PaymentSchedule from '../../database/models/PaymentSchedule';
import SavingsTransaction from '../../database/models/SavingsTransaction';
import ActionLog from '../../database/models/ActionLog';
import { AutoPostingService } from '../AutoPostingService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { JournalEntryService, JournalEntryServiceClass } from '../JournalEntryService';

jest.mock('../AuthService', () => ({
    AuthService: {
        getCurrentUserId: jest.fn().mockResolvedValue('test-user'),
    },
}));

describe('PaymentService', () => {
    let database: Database;

    beforeEach(async () => {
        database = createTestDatabase();
        (JournalEntryService as any).db = database;
        (ChartOfAccountsService as any).db = database;
        (AutoPostingService as any).db = database;
        (AutoPostingService as any).journalEntryService = new JournalEntryServiceClass(database);
        await ChartOfAccountsService.seed('TestUser');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    async function createLoanWithSchedules() {
        const { borrower, collector, loan } = await createTestData(database, { loanAmount: 300, status: 'active' });
        await database.write(async () => {
            await loan.update(l => {
                l.totalAmount = 300;
                l.principalAmount = 240;
                l.interestAmount = 30;
                l.depositAmount = 30;
                l.collectorId = collector.id;
                l.status = 'active';
            });

            for (let index = 0; index < 3; index += 1) {
                await database.get<PaymentSchedule>('payment_schedules').create(schedule => {
                    schedule.loanId = loan.id;
                    schedule.dueDate = Date.now() + index * 86400000;
                    schedule.scheduledAmount = 100;
                    schedule.principalAmount = 80;
                    schedule.interestAmount = 10;
                    schedule.feesAmount = 10;
                    schedule.status = 'pending';
                });
            }
        });

        return { borrower, collector, loan };
    }

    it('allocates cumulative partial payments and marks schedules paid when totals catch up', async () => {
        const { borrower, collector, loan } = await createLoanWithSchedules();

        await PaymentService.postPayment({
            loanId: loan.id,
            amount: 40,
            paymentDate: Date.now(),
            encodedBy: 'admin-user',
            database,
        });

        let schedules = await database.get<PaymentSchedule>('payment_schedules').query(Q.sortBy('due_date', Q.asc)).fetch();
        expect(schedules[0].status).toBe('partial');

        await PaymentService.postPayment({
            loanId: loan.id,
            amount: 60,
            paymentDate: Date.now(),
            encodedBy: 'admin-user',
            database,
        });

        schedules = await database.get<PaymentSchedule>('payment_schedules').query(Q.sortBy('due_date', Q.asc)).fetch();
        expect(schedules[0].status).toBe('paid');
        expect(schedules[1].status).toBe('pending');

        const payments = await database.get<Payment>('payments').query(Q.sortBy('payment_date', Q.asc)).fetch();
        expect(payments[0].scheduleId).toBe(schedules[0].id);
        expect(payments[1].scheduleId).toBe(schedules[0].id);
        expect(payments[0].borrowerId).toBe(borrower.id);
        expect(payments[0].collectorId).toBe(collector.id);

        const savings = await database.get<SavingsTransaction>('savings_transactions').query().fetch();
        expect(savings).toHaveLength(1);
        expect(savings[0].amount).toBeCloseTo(10);
    });

    it('marks a loan paid when posted payments cover the receivable', async () => {
        const { loan } = await createLoanWithSchedules();

        await PaymentService.postPayment({
            loanId: loan.id,
            amount: 300,
            paymentDate: Date.now(),
            encodedBy: 'admin-user',
            database,
        });

        const updatedLoan = await database.get<Loan>('loans').find(loan.id);
        expect(updatedLoan.status).toBe('paid');

        const schedules = await database.get<PaymentSchedule>('payment_schedules').query().fetch();
        expect(schedules.every(schedule => schedule.status === 'paid')).toBe(true);
    });

    it('stores current salary and computed excess cash on payment records', async () => {
        const { loan } = await createLoanWithSchedules();

        const payment = await PaymentService.postPayment({
            loanId: loan.id,
            amount: 1250,
            currentSalary: 5000,
            paymentDate: Date.now(),
            encodedBy: 'admin-user',
            database,
        });

        expect(payment.currentSalary).toBe(5000);
        expect(payment.excessCash).toBe(3750);
    });

    it('writes audit logs for payment, schedule, savings, and loan status changes', async () => {
        const { loan } = await createLoanWithSchedules();

        await PaymentService.postPayment({
            loanId: loan.id,
            amount: 300,
            paymentDate: Date.now(),
            encodedBy: 'admin-user',
            database,
        });

        const logs = await database.get<ActionLog>('action_logs').query().fetch();
        expect(logs.some(log => log.entityType === 'payments' && log.action === 'CREATE')).toBe(true);
        expect(logs.some(log => log.entityType === 'payment_schedules' && log.action === 'UPDATE')).toBe(true);
        expect(logs.some(log => log.entityType === 'savings_transactions' && log.action === 'CREATE')).toBe(true);
        expect(logs.some(log => log.entityType === 'loans' && log.action === 'UPDATE')).toBe(true);
    });

    it('soft-deletes a payment, reverses linked savings deposits, and recomputes loan state', async () => {
        const { loan } = await createLoanWithSchedules();

        const payment = await PaymentService.postPayment({
            loanId: loan.id,
            amount: 300,
            paymentDate: Date.now(),
            encodedBy: 'admin-user',
            database,
        });

        await PaymentService.softDeletePayment(payment.id, {
            database,
            performedBy: 'admin-user',
        });

        const deletedPayment = await database.get<Payment>('payments').find(payment.id);
        expect(deletedPayment.deletedAt).not.toBeNull();

        const linkedSavings = await database.get<SavingsTransaction>('savings_transactions')
            .query(Q.where('reference_id', payment.id))
            .fetch();
        expect(linkedSavings.length).toBeGreaterThan(0);
        expect(linkedSavings.every(tx => tx.deletedAt !== null)).toBe(true);

        const updatedLoan = await database.get<Loan>('loans').find(loan.id);
        expect(updatedLoan.status).toBe('active');

        const schedules = await database.get<PaymentSchedule>('payment_schedules')
            .query(Q.sortBy('due_date', Q.asc))
            .fetch();
        expect(schedules.every(schedule => schedule.status !== 'paid')).toBe(true);

        const logs = await database.get<ActionLog>('action_logs').query().fetch();
        expect(logs.some(log => log.entityType === 'payments' && log.action === 'DELETE')).toBe(true);
        expect(logs.some(log => log.entityType === 'savings_transactions' && log.action === 'DELETE')).toBe(true);
    });

    it('updates payment details, writes audit log, and recomputes loan state', async () => {
        const { loan } = await createLoanWithSchedules();
        const originalDate = Date.now() - 86400000;
        const editedDate = Date.now();

        const payment = await PaymentService.postPayment({
            loanId: loan.id,
            amount: 300,
            paymentDate: originalDate,
            receiptNumber: 'RCT-OLD',
            notes: 'old note',
            encodedBy: 'admin-user',
            database,
        });

        await PaymentService.updatePayment(payment.id, {
            amount: 50,
            paymentDate: editedDate,
            receiptNumber: 'RCT-NEW',
            notes: 'corrected date',
            performedBy: 'admin-user',
            database,
        });

        const updatedPayment = await database.get<Payment>('payments').find(payment.id);
        expect(updatedPayment.amount).toBe(50);
        expect(new Date(updatedPayment.paymentDate as any).getTime()).toBe(editedDate);
        expect(updatedPayment.receiptNumber).toBe('RCT-NEW');
        expect(updatedPayment.notes).toBe('corrected date');

        const updatedLoan = await database.get<Loan>('loans').find(loan.id);
        expect(updatedLoan.status).toBe('active');

        const logs = await database.get<ActionLog>('action_logs').query().fetch();
        const paymentUpdateLog = logs.find(log => log.entityType === 'payments' && log.action === 'UPDATE');
        expect(paymentUpdateLog).toBeDefined();
        expect(paymentUpdateLog?.oldData).toContain('RCT-OLD');
        expect(paymentUpdateLog?.newData).toContain('RCT-NEW');
    });

    it('removes excess auto-deposits when a payment edit reduces paid schedules', async () => {
        const { loan } = await createLoanWithSchedules();

        const payment = await PaymentService.postPayment({
            loanId: loan.id,
            amount: 300,
            paymentDate: Date.now(),
            encodedBy: 'admin-user',
            database,
        });

        let linkedAutoDeposits = await database.get<SavingsTransaction>('savings_transactions')
            .query(Q.where('reference_id', payment.id), Q.where('type', 'deposit'))
            .fetch();
        expect(linkedAutoDeposits.filter(tx => tx.deletedAt === null)).toHaveLength(3);

        await PaymentService.updatePayment(payment.id, {
            amount: 50,
            paymentDate: Date.now(),
            performedBy: 'admin-user',
            database,
        });

        linkedAutoDeposits = await database.get<SavingsTransaction>('savings_transactions')
            .query(Q.where('reference_id', payment.id), Q.where('type', 'deposit'))
            .fetch();
        expect(linkedAutoDeposits.filter(tx => tx.deletedAt === null)).toHaveLength(0);

        const schedules = await database.get<PaymentSchedule>('payment_schedules')
            .query(Q.sortBy('due_date', Q.asc))
            .fetch();
        expect(schedules[0].status).toBe('partial');
        expect(schedules.slice(1).every(schedule => schedule.status !== 'paid')).toBe(true);
    });

    it('applies savings to a loan through the central payment flow', async () => {
        const { borrower, loan } = await createLoanWithSchedules();

        const payment = await PaymentService.applySavingsToLoan({
            loanId: loan.id,
            amount: 100,
            paymentDate: Date.now(),
            borrowerId: borrower.id,
            notes: 'Savings to loan',
            encodedBy: 'admin-user',
            database,
        });

        const linkedSavings = await database.get<SavingsTransaction>('savings_transactions')
            .query(Q.where('reference_id', payment.id))
            .fetch();

        const withdrawal = linkedSavings.find(tx => tx.type === 'withdraw_loan');
        const autoDeposit = linkedSavings.find(tx => tx.type === 'deposit');

        expect(withdrawal).toBeDefined();
        expect(withdrawal?.amount).toBe(100);
        expect(payment.borrowerId).toBe(borrower.id);
        expect(autoDeposit).toBeDefined();
        expect(autoDeposit?.amount).toBeCloseTo(10);
    });

    it('posts savings-to-loan payment and withdrawal journals with zero net cash movement', async () => {
        const { borrower, loan } = await createLoanWithSchedules();

        const payment = await PaymentService.applySavingsToLoan({
            loanId: loan.id,
            amount: 100,
            paymentDate: new Date('2026-04-15T00:00:00.000Z'),
            borrowerId: borrower.id,
            notes: 'Savings to loan',
            encodedBy: 'admin-user',
            database,
        });

        const linkedSavings = await database.get<SavingsTransaction>('savings_transactions')
            .query(Q.where('reference_id', payment.id), Q.where('type', 'withdraw_loan'))
            .fetch();
        expect(linkedSavings).toHaveLength(1);

        const paymentEntry = await JournalEntryService.getEntryBySource('payments', payment.id);
        const withdrawalEntry = await JournalEntryService.getEntryBySource('savings_transactions', linkedSavings[0].id);
        expect(paymentEntry).toBeDefined();
        expect(withdrawalEntry).toBeDefined();

        const paymentLines = await JournalEntryService.getLinesForEntry(paymentEntry!.id);
        const withdrawalLines = await JournalEntryService.getLinesForEntry(withdrawalEntry!.id);
        const allLines = [...paymentLines, ...withdrawalLines];
        const netCashOnHand = allLines.reduce((sum, line) => {
            if (line.accountCode !== '1010') return sum;
            return sum + (line.debitAmount || 0) - (line.creditAmount || 0);
        }, 0);

        expect(paymentLines.find(line => line.accountCode === '1010')?.debitAmount).toBe(100);
        expect(withdrawalLines.find(line => line.accountCode === '1010')?.creditAmount).toBe(100);
        expect(withdrawalLines.find(line => line.accountCode === '2010')?.debitAmount).toBe(100);
        expect(netCashOnHand).toBe(0);
    });
    it('calculates getLoanBalance correctly with payments and penalties', async () => {
        const { loan } = await createLoanWithSchedules();

        // Add payment
        await PaymentService.postPayment({
            loanId: loan.id,
            amount: 50,
            paymentDate: Date.now(),
            encodedBy: 'admin-user',
            database,
        });

        // Add penalty
        await database.write(async () => {
            await database.get('loan_penalties').create((record: any) => {
                record.loanId = loan.id;
                record.amount = 20;
                record.status = 'active';
            });
        });

        const balanceSummary = await PaymentService.getLoanBalance(loan.id, database);
        
        expect(balanceSummary.totalExpected).toBe(320); // 300 loan + 20 penalty
        expect(balanceSummary.totalPaid).toBe(50);
        expect(balanceSummary.balance).toBe(270);
    });

    it('updates a payment that has a linked savings withdrawal', async () => {
        const { borrower, loan } = await createLoanWithSchedules();
        const originalDate = Date.now() - 86400000;
        const editedDate = Date.now();

        // Create payment via savings
        const payment = await PaymentService.applySavingsToLoan({
            loanId: loan.id,
            amount: 100,
            paymentDate: originalDate,
            borrowerId: borrower.id,
            notes: 'Savings to loan',
            encodedBy: 'admin-user',
            database,
        });

        // Update the payment
        await PaymentService.updatePayment(payment.id, {
            amount: 120,
            paymentDate: editedDate,
            notes: 'updated notes',
            performedBy: 'admin-user',
            database,
        });

        const linkedSavings = await database.get<SavingsTransaction>('savings_transactions')
            .query(Q.where('reference_id', payment.id))
            .fetch();

        const withdrawal = linkedSavings.find(tx => tx.type === 'withdraw_loan');
        expect(withdrawal).toBeDefined();
        expect(withdrawal?.amount).toBe(120);
        expect(new Date(withdrawal?.date as any).getTime()).toBe(editedDate);
        expect(withdrawal?.notes).toContain('updated notes');
    });
});
