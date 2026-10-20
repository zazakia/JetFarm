import { Database } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import Expense from '../../database/models/Expense';
import CashTransaction from '../../database/models/CashTransaction';
import BankAccount from '../../database/models/BankAccount';
import BankTransaction from '../../database/models/BankTransaction';
import FinancialSnapshot from '../../database/models/FinancialSnapshot';
import ExpenseCategory from '../../database/models/ExpenseCategory';
import ActionLog from '../../database/models/ActionLog';
import UserProfile from '../../database/models/UserProfile';

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
});
