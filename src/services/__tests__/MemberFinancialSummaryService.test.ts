import { Database } from '@nozbe/watermelondb';
import { createTestDatabase } from '../../__tests__/test-utils';
import { MemberFinancialSummaryServiceClass } from '../MemberFinancialSummaryService';

describe('MemberFinancialSummaryService', () => {
    let database: Database;
    let service: MemberFinancialSummaryServiceClass;

    beforeEach(() => {
        database = createTestDatabase();
        service = new MemberFinancialSummaryServiceClass(database);
    });

    it('summarizes member savings, 2024 starting balances, CBU, and 2025 activity', async () => {
        await database.write(async () => {
            const borrower = await database.get('borrowers').create((b: any) => {
                b.fullName = 'Member A';
                b.memberId = 'M-001';
                b.group = 'Group 1';
            });

            await database.get('savings_transactions').create((tx: any) => {
                tx.borrowerId = borrower.id;
                tx.type = 'deposit';
                tx.amount = 1000;
                tx.date = Date.UTC(2024, 11, 15);
            });
            await database.get('savings_transactions').create((tx: any) => {
                tx.borrowerId = borrower.id;
                tx.type = 'withdraw_cash';
                tx.amount = 200;
                tx.date = Date.UTC(2025, 0, 10);
            });
            await database.get('savings_transactions').create((tx: any) => {
                tx.borrowerId = borrower.id;
                tx.type = 'interest';
                tx.amount = 30;
                tx.date = Date.UTC(2025, 2, 31);
            });
            await database.get('share_capital_transactions').create((tx: any) => {
                tx.memberId = borrower.id;
                tx.transactionType = 'DEPOSIT';
                tx.amount = 500;
                tx.transactionDate = Date.UTC(2024, 10, 1);
            });
            await database.get('share_capital_transactions').create((tx: any) => {
                tx.memberId = borrower.id;
                tx.transactionType = 'DEPOSIT';
                tx.amount = 250;
                tx.transactionDate = Date.UTC(2025, 1, 1);
            });
            await database.get('savings_transactions').create((tx: any) => {
                tx.borrowerId = borrower.id;
                tx.type = 'deposit';
                tx.amount = 400;
                tx.date = Date.UTC(2026, 3, 10);
            });
            await database.get('savings_transactions').create((tx: any) => {
                tx.borrowerId = borrower.id;
                tx.type = 'withdraw_cash';
                tx.amount = 100;
                tx.date = Date.UTC(2026, 4, 15);
            });
            await database.get('share_capital_transactions').create((tx: any) => {
                tx.memberId = borrower.id;
                tx.transactionType = 'DEPOSIT';
                tx.amount = 300;
                tx.transactionDate = Date.UTC(2026, 5, 20);
            });
        });

        const borrower = (await database.get('borrowers').query().fetch())[0] as any;
        const summary = await service.getMemberSummary(borrower.id);

        expect(summary).toMatchObject({
            savingsBalance: 1130,
            cbuBalance: 1050,
            savings2024Balance: 1000,
            cbu2024Balance: 500,
            savings2025Deposits: 30,
            savings2025Withdrawals: 200,
            cbu2025Contributions: 250,
            savings2026Deposits: 400,
            savings2026Withdrawals: 100,
            cbu2026Contributions: 300,
        });
        expect(summary.recentTransactions).toHaveLength(8);
    });

    it('builds portfolio and loan-type summaries for dashboards', async () => {
        await database.write(async () => {
            const borrower = await database.get('borrowers').create((b: any) => {
                b.fullName = 'Member B';
            });
            const loan = await database.get('loans').create((l: any) => {
                l.borrowerId = borrower.id;
                l.loanType = 'emergency';
                l.principalAmount = 1000;
                l.totalAmount = 1200;
                l.status = 'active';
                l.releaseDate = Date.UTC(2025, 0, 5);
            });
            await database.get('payments').create((p: any) => {
                p.loanId = loan.id;
                p.borrowerId = borrower.id;
                p.amount = 300;
                p.paymentDate = Date.UTC(2025, 0, 20);
            });
            await database.get('savings_transactions').create((tx: any) => {
                tx.borrowerId = borrower.id;
                tx.type = 'deposit';
                tx.amount = 400;
                tx.date = Date.UTC(2025, 0, 1);
            });
            await database.get('share_capital_transactions').create((tx: any) => {
                tx.memberId = borrower.id;
                tx.transactionType = 'DEPOSIT';
                tx.amount = 800;
                tx.transactionDate = Date.UTC(2025, 0, 1);
            });
        });

        await expect(service.getPortfolioSummary(2025)).resolves.toMatchObject({
            totalSavingsBalance: 400,
            totalCbuBalance: 800,
            activeSavingsAccounts: 1,
            activeCbuMembers: 1,
            yearSavingsDeposits: 400,
            yearCbuContributions: 800,
        });

        await expect(service.getLoanTypeSummary()).resolves.toEqual([
            expect.objectContaining({
                loanType: 'emergency',
                activeLoans: 1,
                amountReleased: 1000,
                outstandingBalance: 900,
                amountCollected: 300,
                collectionEfficiency: 30,
            }),
        ]);
    });

    it('calculates savings interest at exactly 6 percent per annum', () => {
        expect(service.calculateSavingsInterest(10000, 365)).toBe(600);
        expect(service.calculateMonthlySavingsInterest(12000)).toBe(60);
        expect(service.calculateQuarterlySavingsInterest(12000)).toBe(180);
    });

    it('calculates 2026 opening loan balance deducting cash on hand', () => {
        const res = service.calculate2026OpeningLoanBalance([
            { grossLoanBalance: 50000, cashOnHand: 5000 },
            { grossLoanBalance: 25000, cashOnHand: 2000 },
        ]);
        expect(res.grossLoanBalance).toBe(75000);
        expect(res.cashOnHandDeduction).toBe(7000);
        expect(res.netLoanReceivable).toBe(68000);
    });

    it('calculates 2025 CBU and Savings opening balance and Share Capital credit', () => {
        const res = service.calculate2025CbuSavingsOpeningBalance([
            { savings2025: 1500, cbu2025: 3000, isCashOnHandConnected: true },
            { savings2025: 2500, cbu2025: 5000, isCashOnHandConnected: true },
        ]);
        expect(res.totalSavings2025).toBe(4000);
        expect(res.totalCbu2025).toBe(8000);
        expect(res.shareCapitalCredit).toBe(8000);
        expect(res.cashOnHandConnectedTotal).toBe(12000);
    });
});
