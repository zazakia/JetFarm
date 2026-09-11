import { Database, Q } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase, createTestData } from '../../__tests__/test-utils';
import { LoanService } from '../LoanService';
import Loan from '../../database/models/Loan';
import Payment from '../../database/models/Payment';
import PaymentSchedule from '../../database/models/PaymentSchedule';
import Borrower from '../../database/models/Borrower';
import { LoanCalculatorService } from '../LoanCalculatorService';
import { AutoPostingService } from '../AutoPostingService';
import uuid from 'react-native-uuid';

describe('LoanService', () => {
    let database: Database;

    beforeEach(() => {
        database = createTestDatabase();
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('should save a new loan and generate schedules', async () => {
        const { borrower, collector, loan: defaultLoan } = await createTestData(database);
        // Destroy default loan to allow a clean save (Issue #2 constraint)
        await database.write(async () => {
            await defaultLoan.destroyPermanently();
        });
        const loanId = uuid.v4().toString();
        const calcResult = LoanCalculatorService.calculate(
            1000, 20, 30, 'days', 'flat', 'daily', new Date(), 0, 0
        );

        await LoanService.saveLoan({
            loanId,
            loanNumber: 'L-001',
            borrowerId: borrower.id,
            principalAmount: 1000,
            interestRate: 20,
            interestType: 'flat',
            term: 30,
            termUnit: 'days',
            frequency: 'daily',
            calcResult,
            depositAmount: 0,
            insuranceAmount: 0,
            collectorId: collector.id,
            encodedBy: 'test-user',
            releaseDate: new Date(),
            status: 'active',
            isReloan: false,
            interestAmount: 200,
            isEditing: false,
            database
        });

        const loan = await database.get<Loan>('loans').find(loanId);
        expect(loan.principalAmount).toBe(1000);
        expect(loan.status).toBe('active');

        const schedules = await database.get<PaymentSchedule>('payment_schedules')
            .query()
            .fetch();
        expect(schedules.length).toBe(calcResult.schedule.length);
        expect(schedules[0].loanId).toBe(loanId);
    });

    it('should handle reloan and close previous loan', async () => {
        const { borrower, collector, loan: oldLoan } = await createTestData(database, {
            loanAmount: 1000,
            status: 'active'
        });

        // Add some pending schedules to old loan
        await database.write(async () => {
            await database.get<PaymentSchedule>('payment_schedules').create(s => {
                s.loanId = oldLoan.id;
                s.status = 'pending';
                s.scheduledAmount = 100;
                s.dueDate = new Date().getTime();
            });
        });

        const newLoanId = uuid.v4().toString();
        const calcResult = LoanCalculatorService.calculate(
            2000, 20, 30, 'days', 'flat', 'daily', new Date(), 0, 0
        );

        await LoanService.saveLoan({
            loanId: newLoanId,
            loanNumber: 'L-002',
            borrowerId: borrower.id,
            principalAmount: 2000,
            interestRate: 20,
            interestType: 'flat',
            term: 30,
            termUnit: 'days',
            frequency: 'daily',
            calcResult,
            depositAmount: 0,
            insuranceAmount: 0,
            collectorId: collector.id,
            encodedBy: 'test-user',
            releaseDate: new Date(),
            status: 'active',
            isReloan: true,
            previousLoanId: oldLoan.id,
            deductedAmount: 500,
            interestAmount: 400,
            isEditing: false,
            database
        });

        // Verify old loan is closed
        const updatedOldLoan = await database.get<Loan>('loans').find(oldLoan.id);
        expect(updatedOldLoan.status).toBe('paid');

        // Verify closing payment was created
        const payments = await database.get<Payment>('payments')
            .query()
            .fetch();
        const closingPayment = payments.find(p => p.loanId === oldLoan.id);
        expect(closingPayment).toBeDefined();
        expect(closingPayment?.amount).toBe(500);
        expect(closingPayment?.borrowerId).toBe(borrower.id);
        expect(closingPayment?.notes).toContain('Closed via Renewal');

        // Verify old schedules are marked as paid
        const oldSchedules = await database.get<PaymentSchedule>('payment_schedules')
            .query()
            .fetch();
        const pendingOldSchedules = oldSchedules.filter(s => s.loanId === oldLoan.id && s.status === 'pending');
        expect(pendingOldSchedules.length).toBe(0);
    });

    it('dates the renewal closing payment on the new loan release date', async () => {
        const { borrower, collector, loan: oldLoan } = await createTestData(database, {
            loanAmount: 1000,
            status: 'active'
        });
        const releaseDate = new Date('2026-04-21T00:00:00.000Z');
        const newLoanId = uuid.v4().toString();
        const calcResult = LoanCalculatorService.calculate(
            2000, 20, 30, 'days', 'flat', 'daily', releaseDate, 0, 0
        );

        await LoanService.saveLoan({
            loanId: newLoanId,
            loanNumber: 'L-RELEASE-DATE',
            borrowerId: borrower.id,
            principalAmount: 2000,
            interestRate: 20,
            interestType: 'flat',
            term: 30,
            termUnit: 'days',
            frequency: 'daily',
            calcResult,
            collectorId: collector.id,
            encodedBy: 'test-user',
            releaseDate,
            status: 'active',
            isReloan: true,
            previousLoanId: oldLoan.id,
            deductedAmount: 500,
            interestAmount: 400,
            isEditing: false,
            database
        });

        const payments = await database.get<Payment>('payments')
            .query(Q.where('loan_id', oldLoan.id))
            .fetch();
        expect(payments).toHaveLength(1);
        expect(new Date(payments[0].paymentDate as any).getTime()).toBe(releaseDate.getTime());
    });

    it('should close a previous loan on renewal even when deducted amount is zero', async () => {
        const { borrower, collector, loan: oldLoan } = await createTestData(database, {
            loanAmount: 1000,
            status: 'active'
        });

        await database.write(async () => {
            await database.get<PaymentSchedule>('payment_schedules').create(s => {
                s.loanId = oldLoan.id;
                s.status = 'pending';
                s.scheduledAmount = 100;
                s.dueDate = new Date().getTime();
            });
        });

        const newLoanId = uuid.v4().toString();
        const calcResult = LoanCalculatorService.calculate(
            2000, 20, 30, 'days', 'flat', 'daily', new Date(), 0, 0
        );

        await LoanService.saveLoan({
            loanId: newLoanId,
            loanNumber: 'L-003',
            borrowerId: borrower.id,
            principalAmount: 2000,
            interestRate: 20,
            interestType: 'flat',
            term: 30,
            termUnit: 'days',
            frequency: 'daily',
            calcResult,
            collectorId: collector.id,
            encodedBy: 'test-user',
            releaseDate: new Date(),
            status: 'active',
            isReloan: true,
            previousLoanId: oldLoan.id,
            deductedAmount: 0,
            interestAmount: 400,
            isEditing: false,
            database
        });

        const updatedOldLoan = await database.get<Loan>('loans').find(oldLoan.id);
        expect(updatedOldLoan.status).toBe('paid');

        const payments = await database.get<Payment>('payments').query(Q.where('loan_id', oldLoan.id)).fetch();
        expect(payments).toHaveLength(0);

        const oldSchedules = await database.get<PaymentSchedule>('payment_schedules').query(Q.where('loan_id', oldLoan.id)).fetch();
        expect(oldSchedules.every(s => s.status === 'paid')).toBe(true);
    });

    it('should update an existing loan when isEditing is true', async () => {
        const { borrower, collector, loan: existingLoan } = await createTestData(database);
        
        const calcResult = LoanCalculatorService.calculate(
            1500, 20, 30, 'days', 'flat', 'daily', new Date(), 0, 0
        );

        await LoanService.saveLoan({
            loanId: existingLoan.id,
            loanNumber: existingLoan.loanNumber,
            borrowerId: borrower.id,
            principalAmount: 1500,
            interestRate: 20,
            interestType: 'flat',
            term: 30,
            termUnit: 'days',
            frequency: 'daily',
            calcResult,
            depositAmount: 0,
            insuranceAmount: 0,
            collectorId: collector.id,
            encodedBy: 'test-user',
            releaseDate: new Date(),
            status: 'active',
            isReloan: false,
            interestAmount: 300,
            isEditing: true,
            existingLoan: existingLoan,
            database
        });

        const updatedLoan = await database.get<Loan>('loans').find(existingLoan.id);
        expect(updatedLoan.principalAmount).toBe(1500);
    });

    it('blocks saving a new active loan if the borrower already has an active loan', async () => {
        const { borrower, collector } = await createTestData(database, {
            loanAmount: 1000,
            status: 'active'
        });

        const newLoanId = uuid.v4().toString();
        const calcResult = LoanCalculatorService.calculate(
            1500, 20, 30, 'days', 'flat', 'daily', new Date(), 0, 0
        );

        await expect(LoanService.saveLoan({
            loanId: newLoanId,
            loanNumber: 'L-DUPLICATE',
            borrowerId: borrower.id,
            principalAmount: 1500,
            interestRate: 20,
            interestType: 'flat',
            term: 30,
            termUnit: 'days',
            frequency: 'daily',
            calcResult,
            collectorId: collector.id,
            encodedBy: 'test-user',
            releaseDate: new Date(),
            status: 'active',
            isReloan: false,
            interestAmount: 300,
            isEditing: false,
            database
        })).rejects.toThrow('Member already has an active loan. Enforcing 1 active loan per member rule.');
    });

    it('blocks active-loan edits once payments exist to avoid orphaning schedules', async () => {
        const { borrower, collector, loan: existingLoan } = await createTestData(database, {
            loanAmount: 1000,
            status: 'active'
        });
        await database.write(async () => {
            await database.get<Payment>('payments').create(payment => {
                payment.loanId = existingLoan.id;
                payment.amount = 100;
                payment.paymentDate = Date.now();
                payment.collectorId = collector.id;
            });
        });

        const calcResult = LoanCalculatorService.calculate(
            1500, 20, 30, 'days', 'flat', 'daily', new Date(), 0, 0
        );

        await expect(LoanService.saveLoan({
            loanId: existingLoan.id,
            loanNumber: existingLoan.loanNumber,
            borrowerId: borrower.id,
            principalAmount: 1500,
            interestRate: 20,
            interestType: 'flat',
            term: 30,
            termUnit: 'days',
            frequency: 'daily',
            calcResult,
            collectorId: collector.id,
            encodedBy: 'test-user',
            releaseDate: new Date(),
            status: 'active',
            isReloan: false,
            interestAmount: 300,
            isEditing: true,
            existingLoan,
            database
        })).rejects.toThrow('Cannot edit an active loan after payments have been recorded');
    });

    // ─────────────────────────────────────────────────────────
    // REGRESSION: Loan Edit — Field-Level Verification
    // ─────────────────────────────────────────────────────────
    it('persists all financial fields when editing a pending loan', async () => {
        const { borrower, collector, loan: existingLoan } = await createTestData(database, {
            loanAmount: 1000,
            status: 'pending'
        });

        const calcResult = LoanCalculatorService.calculate(
            2000, 18, 12, 'months', 'flat', 'monthly', new Date(), 500, 100
        );

        await LoanService.saveLoan({
            loanId: existingLoan.id,
            loanNumber: existingLoan.loanNumber,
            borrowerId: borrower.id,
            principalAmount: 2000,
            interestRate: 18,
            interestType: 'flat',
            term: 12,
            termUnit: 'months',
            frequency: 'monthly',
            calcResult,
            depositAmount: 500,
            insuranceAmount: 100,
            processingFee: 150,
            collectionFee: 75,
            notarialFee: 50,
            collectorId: collector.id,
            encodedBy: 'test-editor',
            releaseDate: new Date(),
            status: 'pending',
            isReloan: false,
            interestAmount: 360,
            isEditing: true,
            existingLoan,
            database
        });

        const updated = await database.get<Loan>('loans').find(existingLoan.id);
        expect(updated.principalAmount).toBe(2000);
        expect(updated.interestRate).toBe(18);
        expect(updated.interestType).toBe('flat');
        expect(updated.term).toBe(12);
        expect(updated.termUnit).toBe('months');
        expect(updated.frequency).toBe('monthly');
        expect(updated.depositAmount).toBe(500);
        expect(updated.insuranceAmount).toBe(100);
        expect(updated.processingFee).toBe(150);
        expect(updated.collectionFee).toBe(75);
        expect(updated.notarialFee).toBe(50);
        expect(updated.interestAmount).toBe(360);
        expect(updated.status).toBe('pending'); // Status stays pending
    });

    it('promotes a pending loan to active when isEditing with status=active', async () => {
        const { borrower, collector, loan: pendingLoan } = await createTestData(database, {
            loanAmount: 5000,
            status: 'pending'
        });

        const releaseDate = new Date();
        const calcResult = LoanCalculatorService.calculate(
            5000, 20, 30, 'days', 'flat', 'daily', releaseDate, 0, 0
        );

        await LoanService.saveLoan({
            loanId: pendingLoan.id,
            loanNumber: pendingLoan.loanNumber,
            borrowerId: borrower.id,
            principalAmount: 5000,
            interestRate: 20,
            interestType: 'flat',
            term: 30,
            termUnit: 'days',
            frequency: 'daily',
            calcResult,
            depositAmount: 0,
            insuranceAmount: 0,
            collectorId: collector.id,
            encodedBy: 'test-user',
            releaseDate,
            status: 'active',
            isReloan: false,
            interestAmount: 1000,
            isEditing: true,
            existingLoan: pendingLoan,
            database
        });

        const activated = await database.get<Loan>('loans').find(pendingLoan.id);
        expect(activated.status).toBe('active');
        // releaseDate is a @date field — WatermelonDB returns a Date object
        expect(new Date(activated.releaseDate as any).getTime()).toBeGreaterThan(0);

        // Payment schedules must have been generated
        const schedules = await database.get<PaymentSchedule>('payment_schedules')
            .query(Q.where('loan_id', pendingLoan.id))
            .fetch();
        expect(schedules.length).toBe(calcResult.schedule.length);
        expect(schedules.length).toBeGreaterThan(0);
    });

    it('clears old schedules and regenerates when editing an active loan with no payments', async () => {
        const { borrower, collector, loan: existingLoan } = await createTestData(database, {
            loanAmount: 3000,
            status: 'active'
        });

        // Add some existing schedules
        await database.write(async () => {
            await database.get<PaymentSchedule>('payment_schedules').create(s => {
                s.loanId = existingLoan.id;
                s.status = 'pending';
                s.scheduledAmount = 100;
                s.dueDate = Date.now();
            });
            await database.get<PaymentSchedule>('payment_schedules').create(s => {
                s.loanId = existingLoan.id;
                s.status = 'pending';
                s.scheduledAmount = 100;
                s.dueDate = Date.now() + 86400000;
            });
        });

        const oldSchedules = await database.get<PaymentSchedule>('payment_schedules')
            .query(Q.where('loan_id', existingLoan.id))
            .fetch();
        expect(oldSchedules.length).toBe(2);

        // Edit — no payments exist, so this should succeed
        const calcResult = LoanCalculatorService.calculate(
            3000, 20, 30, 'days', 'flat', 'daily', new Date(), 0, 0
        );

        await LoanService.saveLoan({
            loanId: existingLoan.id,
            loanNumber: existingLoan.loanNumber,
            borrowerId: borrower.id,
            principalAmount: 3000,
            interestRate: 20,
            interestType: 'flat',
            term: 30,
            termUnit: 'days',
            frequency: 'daily',
            calcResult,
            depositAmount: 0,
            insuranceAmount: 0,
            collectorId: collector.id,
            encodedBy: 'test-user',
            releaseDate: new Date(),
            status: 'active',
            isReloan: false,
            interestAmount: 600,
            isEditing: true,
            existingLoan,
            database
        });

        // Old schedules must be gone (permanently deleted)
        // New schedules must be created from calcResult
        const newSchedules = await database.get<PaymentSchedule>('payment_schedules')
            .query(Q.where('loan_id', existingLoan.id))
            .fetch();
        expect(newSchedules.length).toBe(calcResult.schedule.length);
    });

    it('auto-posts a double-entry journal entry (DR Loans Receivable / CR Cash on Hand) when loan is disbursed as active', async () => {
        const spy = jest.spyOn(AutoPostingService, 'postLoanDisbursement');
        const borrower = await database.write(async () => {
            return await database.get<Borrower>('borrowers').create(b => {
                b.fullName = 'Juan Dela Cruz';
                b.address = 'Manila';
                b.phone = '09123456789';
            });
        });

        const releaseDate = new Date();
        const calcResult = LoanCalculatorService.calculate(
            5000, 20, 30, 'days', 'flat', 'daily', releaseDate, 0, 0
        );

        const loanId = 'test-loan-disburse-1';
        await LoanService.saveLoan({
            loanId,
            loanNumber: 'L-2026-0001',
            borrowerId: borrower.id,
            principalAmount: 5000,
            interestRate: 20,
            interestType: 'flat',
            term: 30,
            termUnit: 'days',
            frequency: 'daily',
            calcResult,
            collectorId: 'c1',
            encodedBy: 'test-user',
            releaseDate,
            status: 'active',
            isReloan: false,
            interestAmount: 1000,
            isEditing: false,
            database
        });

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
            loanId,
            amount: 5000,
            borrowerName: 'Juan Dela Cruz',
            postedBy: 'test-user',
        }));
        spy.mockRestore();
    });
});

