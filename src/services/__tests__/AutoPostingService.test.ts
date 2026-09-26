import { AutoPostingService } from '../AutoPostingService';
import { JournalEntryService, JournalEntryServiceClass } from '../JournalEntryService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('AutoPostingService', () => {
    let database: Database;

    beforeEach(async () => {
        database = createTestDatabase();
        (JournalEntryService as any).db = database;
        (ChartOfAccountsService as any).db = database;
        (AutoPostingService as any).db = database;
        (AutoPostingService as any).journalEntryService = new JournalEntryServiceClass(database);
        
        // Seed CoA so accounts exist
        await ChartOfAccountsService.seed('TestUser');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('should auto-post loan disbursements correctly', async () => {
        await AutoPostingService.postLoanDisbursement({
            loanId: 'loan-123',
            amount: 15000,
            entryDate: new Date(),
            borrowerName: 'Juan Dela Cruz',
            postedBy: 'TestUser',
        });

        const entry = await JournalEntryService.getEntryBySource('loans', 'loan-123');
        expect(entry).toBeDefined();
        expect(entry?.totalDebit).toBe(15000);
        expect(entry?.totalCredit).toBe(15000);

        const lines = await JournalEntryService.getLinesForEntry(entry!.id);
        const drLine = lines.find(l => l.debitAmount === 15000);
        const crLine = lines.find(l => l.creditAmount === 15000);

        expect(drLine?.accountCode).toBe('1100'); // Loans Receivable
        expect(crLine?.accountCode).toBe('1010'); // Cash on Hand
    });

    it('should auto-post payments with splits (principal + interest + penalty)', async () => {
        await AutoPostingService.postPayment({
            paymentId: 'pay-456',
            principal: 800,
            interest: 200,
            penalty: 50,
            serviceCharge: 10,
            entryDate: new Date(),
            borrowerName: 'Maria Clara',
            postedBy: 'TestUser',
        });

        const entry = await JournalEntryService.getEntryBySource('payments', 'pay-456');
        expect(entry).toBeDefined();
        expect(entry?.totalDebit).toBe(1060); // 800 + 200 + 50 + 10 = 1060

        const lines = await JournalEntryService.getLinesForEntry(entry!.id);
        
        // DR Cash on Hand
        const cashLine = lines.find(l => l.accountCode === '1010');
        expect(cashLine?.debitAmount).toBe(1060);

        // CR Loans Receivable
        const principalLine = lines.find(l => l.accountCode === '1100');
        expect(principalLine?.creditAmount).toBe(800);

        // CR Interest Income
        const interestLine = lines.find(l => l.accountCode === '4010');
        expect(interestLine?.creditAmount).toBe(200);

        // CR Penalties
        const penaltyLine = lines.find(l => l.accountCode === '4040');
        expect(penaltyLine?.creditAmount).toBe(50);
    });

    it('should auto-post expenses and map category correctly', async () => {
        // Test matching "payroll" keyword -> Salaries & Wages (5010)
        await AutoPostingService.postExpense({
            expenseId: 'exp-789',
            amount: 4500,
            category: 'Staff payroll month of June',
            entryDate: new Date(),
            postedBy: 'TestUser',
        });

        const entry = await JournalEntryService.getEntryBySource('expenses', 'exp-789');
        expect(entry).toBeDefined();
        
        const lines = await JournalEntryService.getLinesForEntry(entry!.id);
        const expenseLine = lines.find(l => l.debitAmount === 4500);
        expect(expenseLine?.accountCode).toBe('5010'); // Salaries & Wages

        // Test fallback to Other Operating Expenses (5100)
        await AutoPostingService.postExpense({
            expenseId: 'exp-abc',
            amount: 500,
            category: 'Miscellaneous cleaning items',
            entryDate: new Date(),
            postedBy: 'TestUser',
        });

        const fallbackEntry = await JournalEntryService.getEntryBySource('expenses', 'exp-abc');
        const fallbackLines = await JournalEntryService.getLinesForEntry(fallbackEntry!.id);
        const fallbackExpLine = fallbackLines.find(l => l.debitAmount === 500);
        expect(fallbackExpLine?.accountCode).toBe('5100'); // Other Operating Expenses
    });

    it('should auto-post savings transactions', async () => {
        // Deposit
        await AutoPostingService.postSavingsTransaction({
            transactionId: 'sav-dep',
            type: 'deposit',
            amount: 1500,
            entryDate: new Date(),
            borrowerName: 'Juan',
        });

        const depEntry = await JournalEntryService.getEntryBySource('savings_transactions', 'sav-dep');
        const depLines = await JournalEntryService.getLinesForEntry(depEntry!.id);
        expect(depLines.find(l => l.accountCode === '1010')?.debitAmount).toBe(1500);
        expect(depLines.find(l => l.accountCode === '2010')?.creditAmount).toBe(1500);

        // Withdrawal
        await AutoPostingService.postSavingsTransaction({
            transactionId: 'sav-wdr',
            type: 'withdrawal',
            amount: 500,
            entryDate: new Date(),
            borrowerName: 'Juan',
        });

        const wdrEntry = await JournalEntryService.getEntryBySource('savings_transactions', 'sav-wdr');
        const wdrLines = await JournalEntryService.getLinesForEntry(wdrEntry!.id);
        expect(wdrLines.find(l => l.accountCode === '2010')?.debitAmount).toBe(500);
        expect(wdrLines.find(l => l.accountCode === '1010')?.creditAmount).toBe(500);
    });

    it('should auto-post share capital transactions correctly', async () => {
        await AutoPostingService.postShareCapital({
            transactionId: 'sc-123',
            amount: 12000,
            entryDate: new Date(),
            memberName: 'Juan Dela Cruz',
            postedBy: 'TestUser',
        });

        const entry = await JournalEntryService.getEntryBySource('share_capital_transactions', 'sc-123');
        expect(entry).toBeDefined();
        expect(entry?.totalDebit).toBe(12000);

        const lines = await JournalEntryService.getLinesForEntry(entry!.id);
        const cashLine = lines.find(l => l.accountCode === '1010');
        const scLine = lines.find(l => l.accountCode === '3010');

        expect(cashLine?.debitAmount).toBe(12000);
        expect(scLine?.creditAmount).toBe(12000);
    });
    it('reverses debit and credit accounts for a share-capital withdrawal', async () => {
        await AutoPostingService.postShareCapital({
            transactionId: 'sc-withdrawal-1',
            type: 'withdrawal',
            amount: 2500,
            entryDate: new Date(),
            memberName: 'Juan Dela Cruz',
            postedBy: 'TestUser',
        });

        const entry = await JournalEntryService.getEntryBySource(
            'share_capital_transactions',
            'sc-withdrawal-1'
        );
        const lines = await JournalEntryService.getLinesForEntry(entry!.id);

        expect(lines.find(line => line.accountCode === '3010')?.debitAmount).toBe(2500);
        expect(lines.find(line => line.accountCode === '1010')?.creditAmount).toBe(2500);
    });

    it('should auto-post cash in and out transactions correctly', async () => {
        // Cash In
        await AutoPostingService.postCashTransaction({
            transactionId: 'cash-in-1',
            type: 'in',
            amount: 2500,
            particulars: 'Sale of old office table',
            entryDate: new Date(),
            postedBy: 'TestUser',
        });

        const inEntry = await JournalEntryService.getEntryBySource('cash_transactions', 'cash-in-1');
        expect(inEntry).toBeDefined();
        const inLines = await JournalEntryService.getLinesForEntry(inEntry!.id);
        expect(inLines.find(l => l.accountCode === '1010')?.debitAmount).toBe(2500);
        expect(inLines.find(l => l.accountCode === '4060')?.creditAmount).toBe(2500);

        // Cash Out
        await AutoPostingService.postCashTransaction({
            transactionId: 'cash-out-1',
            type: 'out',
            amount: 1200,
            particulars: 'Emergency plumbing repairs',
            entryDate: new Date(),
            postedBy: 'TestUser',
        });

        const outEntry = await JournalEntryService.getEntryBySource('cash_transactions', 'cash-out-1');
        expect(outEntry).toBeDefined();
        const outLines = await JournalEntryService.getLinesForEntry(outEntry!.id);
        expect(outLines.find(l => l.accountCode === '5100')?.debitAmount).toBe(1200);
        expect(outLines.find(l => l.accountCode === '1010')?.creditAmount).toBe(1200);
    });

    it('should classify CBU cash transactions as Equity (3010) and NOT Other Income (4060)', async () => {
        await AutoPostingService.postCashTransaction({
            transactionId: 'cash-cbu-1',
            type: 'in',
            amount: 5000,
            particulars: 'Member CBU Capital Build-Up Contribution',
            entryDate: new Date(),
            postedBy: 'TestUser',
        });

        const entry = await JournalEntryService.getEntryBySource('cash_transactions', 'cash-cbu-1');
        expect(entry).toBeDefined();
        const lines = await JournalEntryService.getLinesForEntry(entry!.id);
        expect(lines.find(l => l.accountCode === '1010')?.debitAmount).toBe(5000); // DR Cash on Hand
        expect(lines.find(l => l.accountCode === '3010')?.creditAmount).toBe(5000); // CR Share Capital
        expect(lines.find(l => l.accountCode === '4060')).toBeUndefined(); // NOT Other Income
    });

    it('should correctly split Total CBU and Savings Migration into Equity (3010) and Liabilities (2010)', async () => {
        await AutoPostingService.postCashTransaction({
            transactionId: 'cash-mig-1',
            type: 'in',
            amount: 633968.78,
            particulars: 'Total CBU and Savings Migration 2025',
            entryDate: new Date(),
            postedBy: 'TestUser',
        });

        const entry = await JournalEntryService.getEntryBySource('cash_transactions', 'cash-mig-1');
        expect(entry).toBeDefined();
        const lines = await JournalEntryService.getLinesForEntry(entry!.id);
        
        expect(lines.find(l => l.accountCode === '1010')?.debitAmount).toBe(633968.78);
        expect(lines.find(l => l.accountCode === '3010')?.creditAmount).toBe(454836.15); // Share Capital
        expect(lines.find(l => l.accountCode === '2010')?.creditAmount).toBe(179132.63); // Savings Deposits Payable
        expect(lines.find(l => l.accountCode === '4060')).toBeUndefined(); // 0 to Other Income
    });

    it('reclassifyLegacyCbuEntries correctly heals legacy entries from 4060 to 3010 and 2010', async () => {
        // Manually create an old bad entry with 4060 for CBU migration
        const badEntry = await JournalEntryService.createEntry({
            entryDate: new Date(),
            description: 'Total CBU and Savings Migration 2025',
            entryType: 'auto',
            sourceTable: 'cash_transactions',
            sourceId: 'legacy-cbu-bad',
            postedBy: 'system',
            lines: [
                {
                    accountCode: '1010',
                    accountName: 'Cash on Hand',
                    debitAmount: 633968.78,
                    description: 'Cash received',
                },
                {
                    accountCode: '4060',
                    accountName: 'Other Income',
                    creditAmount: 633968.78,
                    description: 'Other income',
                },
            ],
        }, 'system');

        // Verify initial bad state
        let lines = await JournalEntryService.getLinesForEntry(badEntry.id);
        expect(lines.find(l => l.accountCode === '4060')?.creditAmount).toBe(633968.78);

        // Run reclassification
        const fixed = await AutoPostingService.reclassifyLegacyCbuEntries();
        expect(fixed).toBeGreaterThanOrEqual(1);

        // Verify corrected state
        lines = await JournalEntryService.getLinesForEntry(badEntry.id);
        expect(lines.find(l => l.accountCode === '4060')).toBeUndefined();
        expect(lines.find(l => l.accountCode === '3010')?.creditAmount).toBe(454836.15);
        expect(lines.find(l => l.accountCode === '2010')?.creditAmount).toBe(179132.63);
    });

    it('should auto-post bank transactions correctly', async () => {
        // Bank Deposit (Cash -> Bank)
        await AutoPostingService.postBankTransaction({
            transactionId: 'bank-dep-1',
            type: 'deposit',
            amount: 8000,
            entryDate: new Date(),
            postedBy: 'TestUser',
        });

        const depEntry = await JournalEntryService.getEntryBySource('bank_transactions', 'bank-dep-1');
        expect(depEntry).toBeDefined();
        const depLines = await JournalEntryService.getLinesForEntry(depEntry!.id);
        expect(depLines.find(l => l.accountCode === '1020')?.debitAmount).toBe(8000);
        expect(depLines.find(l => l.accountCode === '1010')?.creditAmount).toBe(8000);

        // Bank Withdrawal (Bank -> Cash)
        await AutoPostingService.postBankTransaction({
            transactionId: 'bank-wdr-1',
            type: 'withdrawal',
            amount: 5000,
            bankAccountCode: '1030',
            particulars: 'PNB withdrawal for petty cash refill',
            entryDate: new Date(),
            postedBy: 'TestUser',
        });

        const wdrEntry = await JournalEntryService.getEntryBySource('bank_transactions', 'bank-wdr-1');
        expect(wdrEntry).toBeDefined();
        const wdrLines = await JournalEntryService.getLinesForEntry(wdrEntry!.id);
        expect(wdrLines.find(l => l.accountCode === '1010')?.debitAmount).toBe(5000);
        expect(wdrLines.find(l => l.accountCode === '1030')?.creditAmount).toBe(5000);
    });

    it('should auto-post membership fees collection correctly', async () => {
        await AutoPostingService.postMembershipFee({
            sourceId: 'borrower-123',
            amount: 500,
            memberName: 'Maria Clara',
            entryDate: new Date(),
            postedBy: 'TestUser',
        });

        const entry = await JournalEntryService.getEntryBySource('borrowers', 'borrower-123');
        expect(entry).toBeDefined();
        const lines = await JournalEntryService.getLinesForEntry(entry!.id);
        expect(lines.find(l => l.accountCode === '1010')?.debitAmount).toBe(500);
        expect(lines.find(l => l.accountCode === '4070')?.creditAmount).toBe(500); // Miscellaneous Income
    });

    it('should auto-post fund transfer between COH and Petty Cash', async () => {
        await AutoPostingService.postFundTransfer({
            transferId: 'tr-101',
            sourceAccountCode: '1010',
            destinationAccountCode: '1011',
            amount: 2000,
            entryDate: new Date(),
            postedBy: 'TestUser',
        });

        const entry = await JournalEntryService.getEntryBySource('cash_transactions', 'tr-101');
        expect(entry).toBeDefined();
        const lines = await JournalEntryService.getLinesForEntry(entry!.id);
        expect(lines.find(l => l.accountCode === '1011')?.debitAmount).toBe(2000);
        expect(lines.find(l => l.accountCode === '1010')?.creditAmount).toBe(2000);
    });

    it('should auto-post bank withdrawal to cash on hand', async () => {
        await AutoPostingService.postBankWithdrawalToCashOnHand({
            transactionId: 'bw-202',
            amount: 15000,
            bankAccountCode: '1020',
            referenceNumber: 'CHK-9988',
            entryDate: new Date(),
            postedBy: 'TestUser',
        });

        const entry = await JournalEntryService.getEntryBySource('bank_transactions', 'bw-202');
        expect(entry).toBeDefined();
        const lines = await JournalEntryService.getLinesForEntry(entry!.id);
        expect(lines.find(l => l.accountCode === '1010')?.debitAmount).toBe(15000);
        expect(lines.find(l => l.accountCode === '1020')?.creditAmount).toBe(15000);
    });

    it('should auto-post farm expenses for jet (cash) and investor (equity)', async () => {
        // Jet-funded fertilizer expense -> DR 5162, CR 1010
        await AutoPostingService.postAgriFarmExpense({
            expenseId: 'agri-exp-1',
            amount: 8500,
            category: 'fertilizer',
            description: '14-14-14 Complete Fertilizer 10 bags',
            paidBy: 'jet',
            cropCycleId: 'cycle-001',
            entryDate: new Date(),
            postedBy: 'OperatorJet',
        });

        const entry1 = await JournalEntryService.getEntryBySource('agri_farm_expenses', 'agri-exp-1');
        expect(entry1).toBeDefined();
        expect(entry1?.totalDebit).toBe(8500);
        expect(entry1?.totalCredit).toBe(8500);

        const lines1 = await JournalEntryService.getLinesForEntry(entry1!.id);
        expect(lines1.find(l => l.accountCode === '5162')?.debitAmount).toBe(8500);
        expect(lines1.find(l => l.accountCode === '1010')?.creditAmount).toBe(8500);
        expect(lines1[0].businessUnitId).toBe('agribusiness');

        // Investor-funded tractor expense -> DR 5164, CR 3015
        await AutoPostingService.postAgriFarmExpense({
            expenseId: 'agri-exp-2',
            amount: 12000,
            category: 'tractor_equipment',
            description: 'Tractor plowing and furrowing 4 ha',
            paidBy: 'investor',
            cropCycleId: 'cycle-001',
            entryDate: new Date(),
            postedBy: 'BioGreenAdmin',
        });

        const entry2 = await JournalEntryService.getEntryBySource('agri_farm_expenses', 'agri-exp-2');
        expect(entry2).toBeDefined();
        const lines2 = await JournalEntryService.getLinesForEntry(entry2!.id);
        expect(lines2.find(l => l.accountCode === '5164')?.debitAmount).toBe(12000);
        expect(lines2.find(l => l.accountCode === '3015')?.creditAmount).toBe(12000);
    });

    it('should auto-post land owner weekly settlements correctly', async () => {
        // Paid settlement -> DR 5160, CR 1010
        await AutoPostingService.postAgriWeeklySettlement({
            settlementId: 'agri-set-1',
            cropCycleId: 'cycle-001',
            weekNumber: 1,
            landOwnerName: 'Don Ramon Valderama',
            netPayoutDue: 25000,
            paymentStatus: 'paid',
            disbursementDate: new Date(),
            postedBy: 'JetAdmin',
        });

        const entry = await JournalEntryService.getEntryBySource('agri_weekly_settlements', 'agri-set-1');
        expect(entry).toBeDefined();
        expect(entry?.totalDebit).toBe(25000);
        const lines = await JournalEntryService.getLinesForEntry(entry!.id);
        expect(lines.find(l => l.accountCode === '5160')?.debitAmount).toBe(25000);
        expect(lines.find(l => l.accountCode === '1010')?.creditAmount).toBe(25000);

        // Approved but unpaid settlement -> DR 5160, CR 2035 (Payable)
        await AutoPostingService.postAgriWeeklySettlement({
            settlementId: 'agri-set-2',
            cropCycleId: 'cycle-001',
            weekNumber: 2,
            landOwnerName: 'Don Ramon Valderama',
            netPayoutDue: 18000,
            paymentStatus: 'approved',
            disbursementDate: null,
            postedBy: 'JetAdmin',
        });

        const entry2 = await JournalEntryService.getEntryBySource('agri_weekly_settlements', 'agri-set-2');
        expect(entry2).toBeDefined();
        const lines2 = await JournalEntryService.getLinesForEntry(entry2!.id);
        expect(lines2.find(l => l.accountCode === '5160')?.debitAmount).toBe(18000);
        expect(lines2.find(l => l.accountCode === '2035')?.creditAmount).toBe(18000);
    });

    it('should auto-post farm labor logs for field workers', async () => {
        // Paid labor -> DR 5161, CR 1010
        await AutoPostingService.postAgriLaborLog({
            laborLogId: 'labor-1',
            workerName: 'Mang Juan',
            task: 'Cassava Stem Planting',
            totalPay: 3500,
            paymentStatus: 'paid',
            workDate: new Date(),
            cropCycleId: 'cycle-001',
            postedBy: 'SupervisorDan',
        });

        const entry = await JournalEntryService.getEntryBySource('agri_labor_logs', 'labor-1');
        expect(entry).toBeDefined();
        const lines = await JournalEntryService.getLinesForEntry(entry!.id);
        expect(lines.find(l => l.accountCode === '5161')?.debitAmount).toBe(3500);
        expect(lines.find(l => l.accountCode === '1010')?.creditAmount).toBe(3500);
    });

    it('should auto-post harvest sales and off-take revenue', async () => {
        // Off-take delivery: 15,000 kg @ ₱4.00/kg = ₱60,000 -> DR 1010, CR 4140
        await AutoPostingService.postAgriHarvestSale({
            harvestLogId: 'harvest-01',
            cropCycleId: 'cycle-001',
            batchNumber: 'BATCH-2026-001',
            netWeightKg: 15000,
            pricePerKilo: 4.0,
            grossRevenue: 60000,
            harvestDate: new Date(),
            postedBy: 'ScaleSupervisor',
        });

        const entry = await JournalEntryService.getEntryBySource('agri_harvest_logs', 'harvest-01');
        expect(entry).toBeDefined();
        expect(entry?.totalDebit).toBe(60000);
        const lines = await JournalEntryService.getLinesForEntry(entry!.id);
        expect(lines.find(l => l.accountCode === '1010')?.debitAmount).toBe(60000);
        expect(lines.find(l => l.accountCode === '4140')?.creditAmount).toBe(60000);
    });

    it('should auto-post investor capital injection and harvest off-take deductions', async () => {
        // Capital injection -> DR 1010, CR 3015
        await AutoPostingService.postAgriInvestorTransaction({
            ledgerId: 'inv-leg-1',
            investorName: 'BioGreen Corp',
            type: 'capital_injection',
            amount: 500000,
            transactionDate: new Date(),
            postedBy: 'CFO',
        });

        const entry1 = await JournalEntryService.getEntryBySource('agri_investor_ledgers', 'inv-leg-1');
        expect(entry1).toBeDefined();
        expect(entry1?.totalDebit).toBe(500000);
        const lines1 = await JournalEntryService.getLinesForEntry(entry1!.id);
        expect(lines1.find(l => l.accountCode === '1010')?.debitAmount).toBe(500000);
        expect(lines1.find(l => l.accountCode === '3015')?.creditAmount).toBe(500000);
    });

    it('should backfill unposted transactions cleanly without creating duplicates', async () => {
        // Create an unposted payment
        await database.write(async () => {
            await database.get('payments').create((p: any) => {
                p._raw.id = 'unposted-pay-1';
                p.amount = 1200;
                p.paymentDate = Date.now();
                p.collectorId = 'test-coll';
            });

            // Create an unposted savings deposit
            await database.get('savings_transactions').create((st: any) => {
                st._raw.id = 'unposted-sav-1';
                st.amount = 500;
                st.type = 'deposit';
                st.date = Date.now();
            });

            // Create an unposted farm expense
            await database.get('agri_farm_expenses').create((fe: any) => {
                fe._raw.id = 'unposted-agri-exp-1';
                fe.amount = 4200;
                fe.category = 'herbicide_pesticide';
                fe.description = 'Weedone Herbicide 5 Liters';
                fe.paidBy = 'jet';
                fe.expenseDate = Date.now();
            });
        });

        // Run backfill
        const res = await AutoPostingService.backfillUnpostedTransactions();
        expect(res.postedCount).toBeGreaterThanOrEqual(3);
        expect(res.errors.length).toBe(0);

        // Verify journal entry for payment exists
        const payEntry = await JournalEntryService.getEntryBySource('payments', 'unposted-pay-1');
        expect(payEntry).toBeDefined();
        expect(payEntry?.totalDebit).toBe(1200);

        // Verify journal entry for savings exists
        const savEntry = await JournalEntryService.getEntryBySource('savings_transactions', 'unposted-sav-1');
        expect(savEntry).toBeDefined();
        expect(savEntry?.totalDebit).toBe(500);

        // Verify journal entry for farm expense exists
        const expEntry = await JournalEntryService.getEntryBySource('agri_farm_expenses', 'unposted-agri-exp-1');
        expect(expEntry).toBeDefined();
        expect(expEntry?.totalDebit).toBe(4200);

        // Run backfill again — should post 0 new entries (idempotent)
        const reRun = await AutoPostingService.backfillUnpostedTransactions();
        expect(reRun.postedCount).toBe(0);
    });
});

