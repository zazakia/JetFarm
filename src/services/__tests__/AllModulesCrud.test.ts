import { Database } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase, createTestData } from '../../__tests__/test-utils';
import Borrower from '../../database/models/Borrower';
import Loan from '../../database/models/Loan';
import Payment from '../../database/models/Payment';
import PaymentSchedule from '../../database/models/PaymentSchedule';
import Expense from '../../database/models/Expense';
import CashTransaction from '../../database/models/CashTransaction';
import BankAccount from '../../database/models/BankAccount';
import BankTransaction from '../../database/models/BankTransaction';
import CollectionLog from '../../database/models/CollectionLog';
import FinancialSnapshot from '../../database/models/FinancialSnapshot';
import Remittance from '../../database/models/Remittance';
import SavingsTransaction from '../../database/models/SavingsTransaction';
import ShareCapitalTransaction from '../../database/models/ShareCapitalTransaction';
import ExpenseCategory from '../../database/models/ExpenseCategory';
import LoanPenalty from '../../database/models/LoanPenalty';
import CollectionGroup from '../../database/models/CollectionGroup';
import ActionLog from '../../database/models/ActionLog';
import Collector from '../../database/models/Collector';
import UserProfile from '../../database/models/UserProfile';
import FileCase from '../../database/models/FileCase';

jest.mock('../ActionLogService', () => ({
    __esModule: true,
    default: {
        logAction: jest.fn().mockResolvedValue(undefined),
        logActions: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../AuthService', () => ({
    AuthService: {
        getCurrentUserId: jest.fn().mockResolvedValue('test-user-id'),
    },
}));

describe('All Modules CRUD', () => {
    let database: Database;
    const now = Date.now();

    beforeEach(() => {
        database = createTestDatabase();
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    // ────────────────────────────────────────────────────
    // UserProfile
    // ────────────────────────────────────────────────────
    describe('UserProfile', () => {
        it('creates a new user profile with all fields', async () => {
            let profileId: string;
            await database.write(async () => {
                const profile = await database.get<UserProfile>('user_profiles').create(p => {
                    p.fullName = 'Alice Admin';
                    p.email = 'alice@example.com';
                    p.role = 'admin';
                    p.isActive = true;
                });
                profileId = profile.id;
            });

            const profile = await database.get<UserProfile>('user_profiles').find(profileId);
            expect(profile.fullName).toBe('Alice Admin');
            expect(profile.email).toBe('alice@example.com');
            expect(profile.role).toBe('admin');
            expect(profile.isActive).toBe(true);
        });

        it('updates an existing user profile', async () => {
            let profileId: string;
            await database.write(async () => {
                const profile = await database.get<UserProfile>('user_profiles').create(p => {
                    p.fullName = 'Bob User';
                    p.email = 'bob@example.com';
                    p.role = 'collector';
                    p.isActive = true;
                });
                profileId = profile.id;
            });

            await database.write(async () => {
                const profile = await database.get<UserProfile>('user_profiles').find(profileId);
                await profile.update(p => {
                    p.fullName = 'Bob Updated';
                    p.role = 'admin';
                    p.isActive = false;
                });
            });

            const updated = await database.get<UserProfile>('user_profiles').find(profileId);
            expect(updated.fullName).toBe('Bob Updated');
            expect(updated.role).toBe('admin');
            expect(updated.isActive).toBe(false);
            expect(updated.email).toBe('bob@example.com');
        });
    });

    // ────────────────────────────────────────────────────
    // Collector
    // ────────────────────────────────────────────────────
    describe('Collector', () => {
        it('creates a new collector', async () => {
            let collectorId: string;
            await database.write(async () => {
                const c = await database.get<Collector>('collectors').create(rec => {
                    rec.fullName = 'John Collector';
                    rec.authId = 'auth-123';
                    rec.isActive = true;
                });
                collectorId = c.id;
            });

            const collector = await database.get<Collector>('collectors').find(collectorId);
            expect(collector.fullName).toBe('John Collector');
            expect(collector.authId).toBe('auth-123');
            expect(collector.isActive).toBe(true);
        });

        it('updates a collector name and active status', async () => {
            let collectorId: string;
            await database.write(async () => {
                const c = await database.get<Collector>('collectors').create(rec => {
                    rec.fullName = 'Jane Collector';
                    rec.authId = 'auth-456';
                    rec.isActive = true;
                });
                collectorId = c.id;
            });

            await database.write(async () => {
                const c = await database.get<Collector>('collectors').find(collectorId);
                await c.update(rec => {
                    rec.fullName = 'Jane Updated';
                    rec.isActive = false;
                });
            });

            const updated = await database.get<Collector>('collectors').find(collectorId);
            expect(updated.fullName).toBe('Jane Updated');
            expect(updated.isActive).toBe(false);
        });
    });

    // ────────────────────────────────────────────────────
    // Borrower
    // ────────────────────────────────────────────────────
    describe('Borrower', () => {
        it('creates a new borrower with all fields', async () => {
            let borrowerId: string;
            await database.write(async () => {
                const b = await database.get<Borrower>('borrowers').create(rec => {
                    rec.fullName = 'Maria Santos';
                    rec.firstName = 'Maria';
                    rec.lastName = 'Santos';
                    rec.address = '123 Rizal St';
                    rec.phone = '09171234567';
                    rec.area = 'Area 1';
                    rec.routeIndex = 5;
                    rec.collectorId = 'collector-1';
                    rec.authId = 'auth-borrower-1';
                    rec.dateOfBirth = new Date('1990-05-15').getTime();
                    rec.gender = 'female';
                    rec.notes = 'Test borrower notes';
                    rec.createdBy = 'admin-1';
                    rec.latitude = 14.5;
                    rec.longitude = 121.0;
                    rec.group = 'Group A';
                    rec.coMakerName = 'Jose Rizal';
                    rec.business = 'Sari-sari store';
                    rec.bankName = 'BPI';
                    rec.bankAccountName = 'Maria Santos';
                    rec.bankAccountNumber = '1234567890';
                    rec.bankBranch = 'Makati';
                });
                borrowerId = b.id;
            });

            const borrower = await database.get<Borrower>('borrowers').find(borrowerId);
            expect(borrower.fullName).toBe('Maria Santos');
            expect(borrower.firstName).toBe('Maria');
            expect(borrower.lastName).toBe('Santos');
            expect(borrower.address).toBe('123 Rizal St');
            expect(borrower.phone).toBe('09171234567');
            expect(borrower.area).toBe('Area 1');
            expect(borrower.routeIndex).toBe(5);
            expect(borrower.gender).toBe('female');
            expect(borrower.group).toBe('Group A');
            expect(borrower.business).toBe('Sari-sari store');
            expect(borrower.bankName).toBe('BPI');
            expect(borrower.bankAccountName).toBe('Maria Santos');
            expect(borrower.bankAccountNumber).toBe('1234567890');
            expect(borrower.bankBranch).toBe('Makati');
            expect(borrower.latitude).toBe(14.5);
            expect(borrower.longitude).toBe(121.0);
        });

        it('updates borrower profile fields', async () => {
            const { borrower } = await createTestData(database);

            await database.write(async () => {
                const b = await database.get<Borrower>('borrowers').find(borrower.id);
                await b.update(rec => {
                    rec.fullName = 'Maria Updated';
                    rec.address = '456 New St';
                    rec.phone = '09981234567';
                    rec.business = 'Updated business';
                    rec.bankName = 'BDO';
                    rec.latitude = 15.0;
                    rec.longitude = 122.0;
                });
            });

            const updated = await database.get<Borrower>('borrowers').find(borrower.id);
            expect(updated.fullName).toBe('Maria Updated');
            expect(updated.address).toBe('456 New St');
            expect(updated.phone).toBe('09981234567');
            expect(updated.business).toBe('Updated business');
            expect(updated.bankName).toBe('BDO');
            expect(updated.latitude).toBe(15.0);
            expect(updated.longitude).toBe(122.0);
        });
    });

    // ────────────────────────────────────────────────────
    // Loan
    // ────────────────────────────────────────────────────
    describe('Loan', () => {
        it('creates a new loan with all financial fields', async () => {
            const { borrower, collector } = await createTestData(database);
            let loanId: string;
            await database.write(async () => {
                const l = await database.get<Loan>('loans').create(rec => {
                    rec.borrowerId = borrower.id;
                    rec.loanNumber = 'LN-001';
                    rec.loanType = 'standard';
                    rec.principalAmount = 5000;
                    rec.interestRate = 20;
                    rec.interestType = 'flat';
                    rec.term = 6;
                    rec.termUnit = 'months';
                    rec.frequency = 'monthly';
                    rec.totalAmount = 6000;
                    rec.installmentAmount = 1000;
                    rec.depositAmount = 200;
                    rec.insuranceAmount = 50;
                    rec.processingFee = 150;
                    rec.collectionFee = 100;
                    rec.notarialFee = 300;
                    rec.rodFee = 0;
                    rec.ltoFee = 0;
                    rec.udiRebatableFee = 0;
                    rec.vatOnInterest = 0;
                    rec.vatOnCharges = 0;
                    rec.dstFee = 0;
                    rec.rebateAmount = 0;
                    rec.savingsPerPayment = 100;
                    rec.releaseDate = new Date('2026-05-01').getTime();
                    rec.firstPaymentDate = new Date('2026-06-01').getTime();
                    rec.maturityDate = new Date('2026-11-01').getTime();
                    rec.status = 'active';
                    rec.isReloan = false;
                    rec.deductedAmount = 500;
                    rec.encodedBy = 'encoder-1';
                    rec.collectorId = collector.id;
                    rec.loanBatch = 1;
                    rec.loanCycle = 1;
                    rec.interestAmount = 1000;
                    rec.notes = 'Test loan notes';
                    rec.isDelinquent = false;
                    rec.approvedBy = 'approver-1';
                    rec.approvedAt = now;
                });
                loanId = l.id;
            });

            const loan = await database.get<Loan>('loans').find(loanId);
            expect(loan.loanNumber).toBe('LN-001');
            expect(loan.loanType).toBe('standard');
            expect(loan.principalAmount).toBe(5000);
            expect(loan.interestRate).toBe(20);
            expect(loan.term).toBe(6);
            expect(loan.termUnit).toBe('months');
            expect(loan.frequency).toBe('monthly');
            expect(loan.totalAmount).toBe(6000);
            expect(loan.installmentAmount).toBe(1000);
            expect(loan.depositAmount).toBe(200);
            expect(loan.insuranceAmount).toBe(50);
            expect(loan.processingFee).toBe(150);
            expect(loan.collectionFee).toBe(100);
            expect(loan.status).toBe('active');
            expect(loan.isReloan).toBe(false);
            expect(loan.deductedAmount).toBe(500);
            expect(loan.loanBatch).toBe(1);
            expect(loan.loanCycle).toBe(1);
            expect(loan.interestAmount).toBe(1000);
            expect(loan.isDelinquent).toBe(false);
            expect(loan.approvedBy).toBe('approver-1');
            expect(loan.approvedAt).toBeInstanceOf(Date);
        });

        it('updates loan status and approval fields', async () => {
            const { borrower, collector, loan } = await createTestData(database, {
                loanAmount: 5000,
                status: 'active',
            });

            await database.write(async () => {
                const l = await database.get<Loan>('loans').find(loan.id);
                await l.update(rec => {
                    rec.status = 'closed';
                    rec.notes = 'Updated notes';
                    rec.isDelinquent = true;
                    rec.delinquentSince = now;
                    rec.approvedBy = 'approver-2';
                    rec.approvedAt = now + 1000;
                });
            });

            const updated = await database.get<Loan>('loans').find(loan.id);
            expect(updated.status).toBe('closed');
            expect(updated.notes).toBe('Updated notes');
            expect(updated.isDelinquent).toBe(true);
            expect(updated.delinquentSince).toBeInstanceOf(Date);
            expect(updated.approvedBy).toBe('approver-2');
            expect(updated.approvedAt).toBeInstanceOf(Date);
        });
    });

    // ────────────────────────────────────────────────────
    // Payment
    // ────────────────────────────────────────────────────
    describe('Payment', () => {
        it('creates a payment record', async () => {
            const { borrower, collector, loan } = await createTestData(database);
            let paymentId: string;
            await database.write(async () => {
                const p = await database.get<Payment>('payments').create(rec => {
                    rec.loanId = loan.id;
                    rec.borrowerId = borrower.id;
                    rec.scheduleId = 'schedule-1';
                    rec.collectorId = collector.id;
                    rec.amount = 500;
                    rec.paymentDate = now;
                    rec.receiptNumber = 'RCPT-001';
                    rec.notes = 'Payment notes';
                    rec.encodedAt = now;
                });
                paymentId = p.id;
            });

            const payment = await database.get<Payment>('payments').find(paymentId);
            expect(payment.loanId).toBe(loan.id);
            expect(payment.borrowerId).toBe(borrower.id);
            expect(payment.collectorId).toBe(collector.id);
            expect(payment.amount).toBe(500);
            expect(payment.receiptNumber).toBe('RCPT-001');
            expect(payment.notes).toBe('Payment notes');
        });

        it('updates payment amount and receipt', async () => {
            const { borrower, collector, loan } = await createTestData(database);
            let paymentId: string;
            await database.write(async () => {
                const p = await database.get<Payment>('payments').create(rec => {
                    rec.loanId = loan.id;
                    rec.borrowerId = borrower.id;
                    rec.scheduleId = 'schedule-1';
                    rec.collectorId = collector.id;
                    rec.amount = 300;
                    rec.paymentDate = now;
                    rec.receiptNumber = 'OLD-RCPT';
                });
                paymentId = p.id;
            });

            await database.write(async () => {
                const p = await database.get<Payment>('payments').find(paymentId);
                await p.update(rec => {
                    rec.amount = 600;
                    rec.receiptNumber = 'NEW-RCPT';
                    rec.notes = 'Updated payment';
                });
            });

            const updated = await database.get<Payment>('payments').find(paymentId);
            expect(updated.amount).toBe(600);
            expect(updated.receiptNumber).toBe('NEW-RCPT');
            expect(updated.notes).toBe('Updated payment');
        });
    });

    // ────────────────────────────────────────────────────
    // PaymentSchedule
    // ────────────────────────────────────────────────────
    describe('PaymentSchedule', () => {
        it('creates a payment schedule', async () => {
            const { loan } = await createTestData(database);
            let scheduleId: string;
            await database.write(async () => {
                const s = await database.get<PaymentSchedule>('payment_schedules').create(rec => {
                    rec.loanId = loan.id;
                    rec.dueDate = now + 86400000;
                    rec.scheduledAmount = 1000;
                    rec.principalAmount = 800;
                    rec.interestAmount = 150;
                    rec.feesAmount = 50;
                    rec.status = 'pending';
                });
                scheduleId = s.id;
            });

            const schedule = await database.get<PaymentSchedule>('payment_schedules').find(scheduleId);
            expect(schedule.loanId).toBe(loan.id);
            expect(schedule.scheduledAmount).toBe(1000);
            expect(schedule.principalAmount).toBe(800);
            expect(schedule.interestAmount).toBe(150);
            expect(schedule.feesAmount).toBe(50);
            expect(schedule.status).toBe('pending');
        });

        it('updates schedule status to paid', async () => {
            const { loan } = await createTestData(database);
            let scheduleId: string;
            await database.write(async () => {
                const s = await database.get<PaymentSchedule>('payment_schedules').create(rec => {
                    rec.loanId = loan.id;
                    rec.dueDate = now;
                    rec.scheduledAmount = 500;
                    rec.principalAmount = 400;
                    rec.interestAmount = 75;
                    rec.feesAmount = 25;
                    rec.status = 'pending';
                });
                scheduleId = s.id;
            });

            await database.write(async () => {
                const s = await database.get<PaymentSchedule>('payment_schedules').find(scheduleId);
                await s.update(rec => {
                    rec.status = 'paid';
                });
            });

            const updated = await database.get<PaymentSchedule>('payment_schedules').find(scheduleId);
            expect(updated.status).toBe('paid');
        });
    });

    // ────────────────────────────────────────────────────
    // Expense
    // ────────────────────────────────────────────────────
    describe('Expense', () => {
        it('creates an expense with all fields', async () => {
            let expenseId: string;
            await database.write(async () => {
                const e = await database.get<Expense>('expenses').create(rec => {
                    rec.category = 'Office Supplies';
                    rec.frequency = 'monthly';
                    rec.description = 'Printer ink';
                    rec.payee = 'Office Depot';
                    rec.tin = '123456789';
                    rec.invoiceNumber = 'INV-001';
                    rec.vatAmount = 120;
                    rec.amount = 1000;
                    rec.expenseDate = now;
                    rec.encodedBy = 'admin-1';
                });
                expenseId = e.id;
            });

            const expense = await database.get<Expense>('expenses').find(expenseId);
            expect(expense.category).toBe('Office Supplies');
            expect(expense.frequency).toBe('monthly');
            expect(expense.description).toBe('Printer ink');
            expect(expense.payee).toBe('Office Depot');
            expect(expense.tin).toBe('123456789');
            expect(expense.invoiceNumber).toBe('INV-001');
            expect(expense.vatAmount).toBe(120);
            expect(expense.amount).toBe(1000);
        });

        it('updates expense amount and payee', async () => {
            let expenseId: string;
            await database.write(async () => {
                const e = await database.get<Expense>('expenses').create(rec => {
                    rec.category = 'Rent';
                    rec.frequency = 'monthly';
                    rec.description = 'Office rent';
                    rec.amount = 5000;
                    rec.expenseDate = now;
                    rec.encodedBy = 'admin-1';
                });
                expenseId = e.id;
            });

            await database.write(async () => {
                const e = await database.get<Expense>('expenses').find(expenseId);
                await e.update(rec => {
                    rec.amount = 6000;
                    rec.payee = 'New Landlord';
                    rec.description = 'Updated office rent';
                });
            });

            const updated = await database.get<Expense>('expenses').find(expenseId);
            expect(updated.amount).toBe(6000);
            expect(updated.payee).toBe('New Landlord');
            expect(updated.description).toBe('Updated office rent');
            expect(updated.category).toBe('Rent');
        });
    });

    // ────────────────────────────────────────────────────
    // CashTransaction
    // ────────────────────────────────────────────────────
    describe('CashTransaction', () => {
        it('creates a cash-in transaction', async () => {
            let txnId: string;
            await database.write(async () => {
                const t = await database.get<CashTransaction>('cash_transactions').create(rec => {
                    rec.transactionDate = now;
                    rec.particulars = 'Cash deposit';
                    rec.type = 'in';
                    rec.amount = 10000;
                    rec.remarks = 'Initial deposit';
                    rec.recordedBy = 'admin-1';
                });
                txnId = t.id;
            });

            const txn = await database.get<CashTransaction>('cash_transactions').find(txnId);
            expect(txn.particulars).toBe('Cash deposit');
            expect(txn.type).toBe('in');
            expect(txn.amount).toBe(10000);
            expect(txn.remarks).toBe('Initial deposit');
            expect(txn.recordedBy).toBe('admin-1');
        });

        it('creates a cash-out transaction and updates remarks', async () => {
            let txnId: string;
            await database.write(async () => {
                const t = await database.get<CashTransaction>('cash_transactions').create(rec => {
                    rec.transactionDate = now;
                    rec.particulars = 'Petty cash';
                    rec.type = 'out';
                    rec.amount = 500;
                    rec.remarks = '';
                    rec.recordedBy = 'admin-1';
                });
                txnId = t.id;
            });

            await database.write(async () => {
                const t = await database.get<CashTransaction>('cash_transactions').find(txnId);
                await t.update(rec => {
                    rec.remarks = 'Office supplies';
                    rec.amount = 750;
                });
            });

            const updated = await database.get<CashTransaction>('cash_transactions').find(txnId);
            expect(updated.remarks).toBe('Office supplies');
            expect(updated.amount).toBe(750);
            expect(updated.type).toBe('out');
        });
    });

    // ────────────────────────────────────────────────────
    // BankAccount
    // ────────────────────────────────────────────────────
    describe('BankAccount', () => {
        it('creates a bank account', async () => {
            let accountId: string;
            await database.write(async () => {
                const a = await database.get<BankAccount>('bank_accounts').create(rec => {
                    rec.bankName = 'BPI';
                    rec.accountName = 'Company Account';
                    rec.accountNumber = '0001234567';
                    rec.startingBalance = 50000;
                });
                accountId = a.id;
            });

            const account = await database.get<BankAccount>('bank_accounts').find(accountId);
            expect(account.bankName).toBe('BPI');
            expect(account.accountName).toBe('Company Account');
            expect(account.accountNumber).toBe('0001234567');
            expect(account.startingBalance).toBe(50000);
        });

        it('updates bank account name and number', async () => {
            let accountId: string;
            await database.write(async () => {
                const a = await database.get<BankAccount>('bank_accounts').create(rec => {
                    rec.bankName = 'BDO';
                    rec.accountName = 'Old Name';
                    rec.accountNumber = '1111111111';
                    rec.startingBalance = 10000;
                });
                accountId = a.id;
            });

            await database.write(async () => {
                const a = await database.get<BankAccount>('bank_accounts').find(accountId);
                await a.update(rec => {
                    rec.accountName = 'Updated Name';
                    rec.accountNumber = '2222222222';
                    rec.startingBalance = 20000;
                });
            });

            const updated = await database.get<BankAccount>('bank_accounts').find(accountId);
            expect(updated.accountName).toBe('Updated Name');
            expect(updated.accountNumber).toBe('2222222222');
            expect(updated.startingBalance).toBe(20000);
        });
    });

    // ────────────────────────────────────────────────────
    // BankTransaction
    // ────────────────────────────────────────────────────
    describe('BankTransaction', () => {
        it('creates a bank transaction', async () => {
            let accountId: string;
            await database.write(async () => {
                const a = await database.get<BankAccount>('bank_accounts').create(rec => {
                    rec.bankName = 'BPI';
                    rec.accountName = 'Test';
                    rec.accountNumber = '0000';
                    rec.startingBalance = 1000;
                });
                accountId = a.id;
            });

            let txnId: string;
            await database.write(async () => {
                const t = await database.get<BankTransaction>('bank_transactions').create(rec => {
                    rec.bankAccountId = accountId;
                    rec.transactionDate = now;
                    rec.type = 'deposit';
                    rec.amount = 5000;
                    rec.particulars = 'Client deposit';
                    rec.remarks = 'From client X';
                });
                txnId = t.id;
            });

            const txn = await database.get<BankTransaction>('bank_transactions').find(txnId);
            expect(txn.bankAccountId).toBe(accountId);
            expect(txn.type).toBe('deposit');
            expect(txn.amount).toBe(5000);
            expect(txn.particulars).toBe('Client deposit');
        });

        it('updates bank transaction type and amount', async () => {
            let accountId: string;
            await database.write(async () => {
                const a = await database.get<BankAccount>('bank_accounts').create(rec => {
                    rec.bankName = 'BPI';
                    rec.accountName = 'Test';
                    rec.accountNumber = '0000';
                    rec.startingBalance = 1000;
                });
                accountId = a.id;
            });

            let txnId: string;
            await database.write(async () => {
                const t = await database.get<BankTransaction>('bank_transactions').create(rec => {
                    rec.bankAccountId = accountId;
                    rec.transactionDate = now;
                    rec.type = 'deposit';
                    rec.amount = 1000;
                    rec.particulars = 'Original';
                });
                txnId = t.id;
            });

            await database.write(async () => {
                const t = await database.get<BankTransaction>('bank_transactions').find(txnId);
                await t.update(rec => {
                    rec.type = 'withdrawal';
                    rec.amount = 2000;
                    rec.remarks = 'Updated';
                });
            });

            const updated = await database.get<BankTransaction>('bank_transactions').find(txnId);
            expect(updated.type).toBe('withdrawal');
            expect(updated.amount).toBe(2000);
            expect(updated.remarks).toBe('Updated');
        });
    });

    // ────────────────────────────────────────────────────
    // CollectionLog
    // ────────────────────────────────────────────────────
    describe('CollectionLog', () => {
        it('creates a collection log', async () => {
            let logId: string;
            await database.write(async () => {
                const l = await database.get<CollectionLog>('collection_logs').create(rec => {
                    rec.collectorId = 'collector-1';
                    rec.logDate = now;
                    rec.totalCollected = 15000;
                    rec.cashOnHandStart = 2000;
                    rec.cashOnHandEnd = 17000;
                    rec.notes = 'Good collection day';
                });
                logId = l.id;
            });

            const log = await database.get<CollectionLog>('collection_logs').find(logId);
            expect(log.collectorId).toBe('collector-1');
            expect(log.totalCollected).toBe(15000);
            expect(log.cashOnHandStart).toBe(2000);
            expect(log.cashOnHandEnd).toBe(17000);
            expect(log.notes).toBe('Good collection day');
        });

        it('updates collection totals', async () => {
            let logId: string;
            await database.write(async () => {
                const l = await database.get<CollectionLog>('collection_logs').create(rec => {
                    rec.collectorId = 'collector-2';
                    rec.logDate = now;
                    rec.totalCollected = 5000;
                    rec.cashOnHandStart = 500;
                    rec.cashOnHandEnd = 5500;
                    rec.notes = '';
                });
                logId = l.id;
            });

            await database.write(async () => {
                const l = await database.get<CollectionLog>('collection_logs').find(logId);
                await l.update(rec => {
                    rec.totalCollected = 8000;
                    rec.cashOnHandEnd = 8500;
                    rec.notes = 'Additional collections';
                });
            });

            const updated = await database.get<CollectionLog>('collection_logs').find(logId);
            expect(updated.totalCollected).toBe(8000);
            expect(updated.cashOnHandEnd).toBe(8500);
            expect(updated.notes).toBe('Additional collections');
        });
    });

    // ────────────────────────────────────────────────────
    // FinancialSnapshot
    // ────────────────────────────────────────────────────
    describe('FinancialSnapshot', () => {
        it('creates a financial snapshot', async () => {
            let snapId: string;
            await database.write(async () => {
                const s = await database.get<FinancialSnapshot>('financial_snapshots').create(rec => {
                    rec.snapshotDate = now;
                    rec.totalAssets = 1000000;
                    rec.totalEquity = 700000;
                    rec.totalLiabilities = 300000;
                    rec.loanLossReserve = 50000;
                    rec.operatingRevenue = 200000;
                    rec.financialCosts = 50000;
                    rec.subsidyAdjustment = 10000;
                    rec.inflationAdjustment = 5000;
                    rec.riskWeightedAssets = 800000;
                });
                snapId = s.id;
            });

            const snap = await database.get<FinancialSnapshot>('financial_snapshots').find(snapId);
            expect(snap.totalAssets).toBe(1000000);
            expect(snap.totalEquity).toBe(700000);
            expect(snap.totalLiabilities).toBe(300000);
            expect(snap.loanLossReserve).toBe(50000);
            expect(snap.operatingRevenue).toBe(200000);
            expect(snap.riskWeightedAssets).toBe(800000);
        });

        it('updates snapshot financial figures', async () => {
            let snapId: string;
            await database.write(async () => {
                const s = await database.get<FinancialSnapshot>('financial_snapshots').create(rec => {
                    rec.snapshotDate = now;
                    rec.totalAssets = 500000;
                    rec.totalEquity = 300000;
                    rec.totalLiabilities = 200000;
                    rec.loanLossReserve = 25000;
                    rec.operatingRevenue = 100000;
                    rec.financialCosts = 25000;
                    rec.subsidyAdjustment = 5000;
                    rec.inflationAdjustment = 2500;
                    rec.riskWeightedAssets = 400000;
                });
                snapId = s.id;
            });

            await database.write(async () => {
                const s = await database.get<FinancialSnapshot>('financial_snapshots').find(snapId);
                await s.update(rec => {
                    rec.totalAssets = 600000;
                    rec.totalEquity = 350000;
                    rec.operatingRevenue = 150000;
                });
            });

            const updated = await database.get<FinancialSnapshot>('financial_snapshots').find(snapId);
            expect(updated.totalAssets).toBe(600000);
            expect(updated.totalEquity).toBe(350000);
            expect(updated.operatingRevenue).toBe(150000);
            expect(updated.totalLiabilities).toBe(200000); // unchanged
        });
    });

    // ────────────────────────────────────────────────────
    // Remittance
    // ────────────────────────────────────────────────────
    describe('Remittance', () => {
        it('creates a remittance record', async () => {
            let remId: string;
            await database.write(async () => {
                const r = await database.get<Remittance>('remittances').create(rec => {
                    rec.collectorId = 'collector-3';
                    rec.amount = 25000;
                    rec.remittanceDate = now;
                    rec.status = 'pending';
                    rec.approvedBy = '';
                    rec.notes = 'Weekly remittance';
                });
                remId = r.id;
            });

            const rem = await database.get<Remittance>('remittances').find(remId);
            expect(rem.collectorId).toBe('collector-3');
            expect(rem.amount).toBe(25000);
            expect(rem.status).toBe('pending');
            expect(rem.notes).toBe('Weekly remittance');
        });

        it('updates remittance status to approved', async () => {
            let remId: string;
            await database.write(async () => {
                const r = await database.get<Remittance>('remittances').create(rec => {
                    rec.collectorId = 'collector-4';
                    rec.amount = 10000;
                    rec.remittanceDate = now;
                    rec.status = 'pending';
                    rec.notes = '';
                });
                remId = r.id;
            });

            await database.write(async () => {
                const r = await database.get<Remittance>('remittances').find(remId);
                await r.update(rec => {
                    rec.status = 'approved';
                    rec.approvedBy = 'admin-1';
                    rec.notes = 'Approved by admin';
                });
            });

            const updated = await database.get<Remittance>('remittances').find(remId);
            expect(updated.status).toBe('approved');
            expect(updated.approvedBy).toBe('admin-1');
            expect(updated.notes).toBe('Approved by admin');
        });
    });

    // ────────────────────────────────────────────────────
    // SavingsTransaction
    // ────────────────────────────────────────────────────
    describe('SavingsTransaction', () => {
        it('creates a savings deposit', async () => {
            const { borrower } = await createTestData(database);
            let txnId: string;
            await database.write(async () => {
                const t = await database.get<SavingsTransaction>('savings_transactions').create(rec => {
                    rec.borrowerId = borrower.id;
                    rec.type = 'deposit';
                    rec.amount = 500;
                    rec.referenceId = 'ref-001';
                    rec.date = now;
                    rec.notes = 'Weekly savings';
                });
                txnId = t.id;
            });

            const txn = await database.get<SavingsTransaction>('savings_transactions').find(txnId);
            expect(txn.borrowerId).toBe(borrower.id);
            expect(txn.type).toBe('deposit');
            expect(txn.amount).toBe(500);
            expect(txn.referenceId).toBe('ref-001');
            expect(txn.notes).toBe('Weekly savings');
        });

        it('updates savings transaction type and amount', async () => {
            const { borrower } = await createTestData(database);
            let txnId: string;
            await database.write(async () => {
                const t = await database.get<SavingsTransaction>('savings_transactions').create(rec => {
                    rec.borrowerId = borrower.id;
                    rec.type = 'deposit';
                    rec.amount = 300;
                    rec.referenceId = 'ref-002';
                    rec.date = now;
                    rec.notes = '';
                });
                txnId = t.id;
            });

            await database.write(async () => {
                const t = await database.get<SavingsTransaction>('savings_transactions').find(txnId);
                await t.update(rec => {
                    rec.type = 'withdraw_loan';
                    rec.amount = 300;
                    rec.notes = 'Applied to loan';
                });
            });

            const updated = await database.get<SavingsTransaction>('savings_transactions').find(txnId);
            expect(updated.type).toBe('withdraw_loan');
            expect(updated.notes).toBe('Applied to loan');
        });

        it('soft deletes savings transaction by setting deletedAt', async () => {
            const { borrower } = await createTestData(database);
            let txnId: string;
            await database.write(async () => {
                const t = await database.get<SavingsTransaction>('savings_transactions').create(rec => {
                    rec.borrowerId = borrower.id;
                    rec.type = 'deposit';
                    rec.amount = 400;
                    rec.referenceId = 'ref-003';
                    rec.date = now;
                    rec.notes = '';
                });
                txnId = t.id;
            });

            await database.write(async () => {
                const t = await database.get<SavingsTransaction>('savings_transactions').find(txnId);
                await t.update(rec => {
                    rec.deletedAt = Date.now();
                });
            });

            const deleted = await database.get<SavingsTransaction>('savings_transactions').find(txnId);
            expect(deleted.deletedAt).not.toBeNull();
            expect(deleted.deletedAt).toBeInstanceOf(Date);
        });
    });

    // ────────────────────────────────────────────────────
    // ShareCapitalTransaction (CBU)
    // ────────────────────────────────────────────────────
    describe('ShareCapitalTransaction', () => {
        it('creates, updates and soft-deletes a share capital transaction', async () => {
            const { borrower } = await createTestData(database);
            let txnId: string;

            // 1. Create CBU transaction
            await database.write(async () => {
                const t = await database.get<ShareCapitalTransaction>('share_capital_transactions').create(rec => {
                    rec.memberId = borrower.id;
                    rec.transactionType = 'DEPOSIT';
                    rec.amount = 1000;
                    rec.transactionDate = now;
                    rec.notes = 'Initial deposit';
                });
                txnId = t.id;
            });

            const txn = await database.get<ShareCapitalTransaction>('share_capital_transactions').find(txnId);
            expect(txn.memberId).toBe(borrower.id);
            expect(txn.transactionType).toBe('DEPOSIT');
            expect(txn.amount).toBe(1000);
            expect(txn.notes).toBe('Initial deposit');

            // 2. Update CBU transaction
            await database.write(async () => {
                const t = await database.get<ShareCapitalTransaction>('share_capital_transactions').find(txnId);
                await t.update(rec => {
                    rec.amount = 1500;
                    rec.notes = 'Adjusted deposit';
                });
            });

            const updated = await database.get<ShareCapitalTransaction>('share_capital_transactions').find(txnId);
            expect(updated.amount).toBe(1500);
            expect(updated.notes).toBe('Adjusted deposit');

            // 3. Soft-delete CBU transaction
            await database.write(async () => {
                const t = await database.get<ShareCapitalTransaction>('share_capital_transactions').find(txnId);
                await t.update(rec => {
                    rec.deletedAt = Date.now();
                });
            });

            const deleted = await database.get<ShareCapitalTransaction>('share_capital_transactions').find(txnId);
            expect(deleted.deletedAt).not.toBeNull();
            expect(deleted.deletedAt).toBeInstanceOf(Date);
        });
    });

    // ────────────────────────────────────────────────────
    // ExpenseCategory
    // ────────────────────────────────────────────────────
    describe('ExpenseCategory', () => {
        it('creates an expense category', async () => {
            let catId: string;
            await database.write(async () => {
                const c = await database.get<ExpenseCategory>('expense_categories').create(rec => {
                    rec.name = 'Utilities';
                    rec.isActive = true;
                });
                catId = c.id;
            });

            const cat = await database.get<ExpenseCategory>('expense_categories').find(catId);
            expect(cat.name).toBe('Utilities');
            expect(cat.isActive).toBe(true);
        });

        it('updates category name and deactivates', async () => {
            let catId: string;
            await database.write(async () => {
                const c = await database.get<ExpenseCategory>('expense_categories').create(rec => {
                    rec.name = 'Old Category';
                    rec.isActive = true;
                });
                catId = c.id;
            });

            await database.write(async () => {
                const c = await database.get<ExpenseCategory>('expense_categories').find(catId);
                await c.update(rec => {
                    rec.name = 'New Category';
                    rec.isActive = false;
                });
            });

            const updated = await database.get<ExpenseCategory>('expense_categories').find(catId);
            expect(updated.name).toBe('New Category');
            expect(updated.isActive).toBe(false);
        });
    });

    // ────────────────────────────────────────────────────
    // LoanPenalty
    // ────────────────────────────────────────────────────
    describe('LoanPenalty', () => {
        it('creates a loan penalty', async () => {
            const { loan } = await createTestData(database);
            let penaltyId: string;
            await database.write(async () => {
                const p = await database.get<LoanPenalty>('loan_penalties').create(rec => {
                    rec.loanId = loan.id;
                    rec.amount = 150;
                    rec.penaltyDate = now;
                    rec.reason = 'Late payment';
                });
                penaltyId = p.id;
            });

            const penalty = await database.get<LoanPenalty>('loan_penalties').find(penaltyId);
            expect(penalty.loanId).toBe(loan.id);
            expect(penalty.amount).toBe(150);
            expect(penalty.reason).toBe('Late payment');
        });

        it('updates penalty reason and amount', async () => {
            const { loan } = await createTestData(database);
            let penaltyId: string;
            await database.write(async () => {
                const p = await database.get<LoanPenalty>('loan_penalties').create(rec => {
                    rec.loanId = loan.id;
                    rec.amount = 100;
                    rec.penaltyDate = now;
                    rec.reason = 'Initial reason';
                });
                penaltyId = p.id;
            });

            await database.write(async () => {
                const p = await database.get<LoanPenalty>('loan_penalties').find(penaltyId);
                await p.update(rec => {
                    rec.amount = 200;
                    rec.reason = 'Revised penalty';
                });
            });

            const updated = await database.get<LoanPenalty>('loan_penalties').find(penaltyId);
            expect(updated.amount).toBe(200);
            expect(updated.reason).toBe('Revised penalty');
        });
    });

    // ────────────────────────────────────────────────────
    // CollectionGroup
    // ────────────────────────────────────────────────────
    describe('CollectionGroup', () => {
        it('creates a collection group', async () => {
            let groupId: string;
            await database.write(async () => {
                const g = await database.get<CollectionGroup>('collection_groups').create(rec => {
                    rec.name = 'Monday Group';
                    rec.collectorId = 'collector-5';
                    rec.collectionDay = 1;
                    rec.isActive = true;
                });
                groupId = g.id;
            });

            const group = await database.get<CollectionGroup>('collection_groups').find(groupId);
            expect(group.name).toBe('Monday Group');
            expect(group.collectorId).toBe('collector-5');
            expect(group.collectionDay).toBe(1);
            expect(group.isActive).toBe(true);
        });

        it('updates group name and deactivates', async () => {
            let groupId: string;
            await database.write(async () => {
                const g = await database.get<CollectionGroup>('collection_groups').create(rec => {
                    rec.name = 'Old Group';
                    rec.collectorId = 'collector-6';
                    rec.collectionDay = 3;
                    rec.isActive = true;
                });
                groupId = g.id;
            });

            await database.write(async () => {
                const g = await database.get<CollectionGroup>('collection_groups').find(groupId);
                await g.update(rec => {
                    rec.name = 'Wednesday Group';
                    rec.isActive = false;
                });
            });

            const updated = await database.get<CollectionGroup>('collection_groups').find(groupId);
            expect(updated.name).toBe('Wednesday Group');
            expect(updated.isActive).toBe(false);
            expect(updated.collectionDay).toBe(3);
        });
    });

    // ────────────────────────────────────────────────────
    // ActionLog
    // ────────────────────────────────────────────────────
    describe('ActionLog', () => {
        it('creates an action log entry', async () => {
            let logId: string;
            await database.write(async () => {
                const l = await database.get<ActionLog>('action_logs').create(rec => {
                    rec.entityType = 'borrowers';
                    rec.entityId = 'entity-123';
                    rec.action = 'CREATE';
                    rec.performedBy = 'admin-1';
                    rec.oldData = '{}';
                    rec.newData = '{"full_name":"Test"}';
                    rec.timestamp = now;
                });
                logId = l.id;
            });

            const log = await database.get<ActionLog>('action_logs').find(logId);
            expect(log.entityType).toBe('borrowers');
            expect(log.entityId).toBe('entity-123');
            expect(log.action).toBe('CREATE');
            expect(log.performedBy).toBe('admin-1');
            expect(log.newData).toBe('{"full_name":"Test"}');
        });

        it('creates an update action log', async () => {
            let logId: string;
            await database.write(async () => {
                const l = await database.get<ActionLog>('action_logs').create(rec => {
                    rec.entityType = 'loans';
                    rec.entityId = 'loan-456';
                    rec.action = 'UPDATE';
                    rec.performedBy = 'admin-2';
                    rec.oldData = '{"status":"active"}';
                    rec.newData = '{"status":"closed"}';
                    rec.timestamp = now;
                });
                logId = l.id;
            });

            const log = await database.get<ActionLog>('action_logs').find(logId);
            expect(log.action).toBe('UPDATE');
            expect(log.oldData).toBe('{"status":"active"}');
            expect(log.newData).toBe('{"status":"closed"}');
        });
    });

    // ────────────────────────────────────────────────────
    // FileCase
    // ────────────────────────────────────────────────────
    describe('FileCase', () => {
        it('creates a file case for a loan', async () => {
            const { borrower, loan } = await createTestData(database);
            let caseId: string;
            await database.write(async () => {
                const fc = await database.get<FileCase>('file_cases').create(rec => {
                    rec.loanId = loan.id;
                    rec.borrowerId = borrower.id;
                    rec.caseNumber = 'CASE-2026-001';
                    rec.filedDate = now;
                    rec.status = 'open';
                    rec.notes = 'Filed for collection';
                    rec.filedBy = 'legal-team';
                });
                caseId = fc.id;
            });

            const fc = await database.get<FileCase>('file_cases').find(caseId);
            expect(fc.loanId).toBe(loan.id);
            expect(fc.borrowerId).toBe(borrower.id);
            expect(fc.caseNumber).toBe('CASE-2026-001');
            expect(fc.status).toBe('open');
            expect(fc.filedBy).toBe('legal-team');
        });

        it('updates file case status to resolved', async () => {
            const { borrower, loan } = await createTestData(database);
            let caseId: string;
            await database.write(async () => {
                const fc = await database.get<FileCase>('file_cases').create(rec => {
                    rec.loanId = loan.id;
                    rec.borrowerId = borrower.id;
                    rec.caseNumber = 'CASE-2026-002';
                    rec.filedDate = now;
                    rec.status = 'open';
                    rec.notes = 'Pending resolution';
                    rec.filedBy = 'legal-team';
                });
                caseId = fc.id;
            });

            await database.write(async () => {
                const fc = await database.get<FileCase>('file_cases').find(caseId);
                await fc.update(rec => {
                    rec.status = 'dismissed';
                    rec.notes = 'Case dismissed - settled';
                });
            });

            const updated = await database.get<FileCase>('file_cases').find(caseId);
            expect(updated.status).toBe('dismissed');
            expect(updated.notes).toBe('Case dismissed - settled');
        });
    });

    // ────────────────────────────────────────────────────
    // Cross-module: borrower + loan + payment + schedule
    // ────────────────────────────────────────────────────
    describe('Cross-module workflow', () => {
        it('creates borrower, loan, schedules, and payment in sequence', async () => {
            const { borrower, collector, loan } = await createTestData(database, {
                loanAmount: 3000,
                status: 'active',
            });

            // Create payment schedules
            let scheduleId: string;
            await database.write(async () => {
                const s = await database.get<PaymentSchedule>('payment_schedules').create(rec => {
                    rec.loanId = loan.id;
                    rec.dueDate = now + 86400000;
                    rec.scheduledAmount = 1000;
                    rec.principalAmount = 800;
                    rec.interestAmount = 150;
                    rec.feesAmount = 50;
                    rec.status = 'pending';
                });
                scheduleId = s.id;
            });

            // Create payment
            let paymentId: string;
            await database.write(async () => {
                const p = await database.get<Payment>('payments').create(rec => {
                    rec.loanId = loan.id;
                    rec.borrowerId = borrower.id;
                    rec.scheduleId = scheduleId;
                    rec.collectorId = collector.id;
                    rec.amount = 1000;
                    rec.paymentDate = now;
                    rec.receiptNumber = 'RCPT-CROSS';
                });
                paymentId = p.id;
            });

            // Mark schedule as paid
            await database.write(async () => {
                const s = await database.get<PaymentSchedule>('payment_schedules').find(scheduleId);
                await s.update(rec => { rec.status = 'paid'; });
            });

            // Update loan with delinquent flag after editing
            await database.write(async () => {
                const l = await database.get<Loan>('loans').find(loan.id);
                await l.update(rec => {
                    rec.isDelinquent = false;
                    rec.approvedBy = 'admin-1';
                    rec.approvedAt = now;
                });
            });

            const schedule = await database.get<PaymentSchedule>('payment_schedules').find(scheduleId);
            const payment = await database.get<Payment>('payments').find(paymentId);
            const updatedLoan = await database.get<Loan>('loans').find(loan.id);

            expect(schedule.status).toBe('paid');
            expect(payment.amount).toBe(1000);
            expect(payment.borrowerId).toBe(borrower.id);
            expect(updatedLoan.isDelinquent).toBe(false);
            expect(updatedLoan.approvedBy).toBe('admin-1');
        });
    });
});
