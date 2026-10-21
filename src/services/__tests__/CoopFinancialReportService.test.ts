import { CoopFinancialReportService } from '../CoopFinancialReportService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { JournalEntryService } from '../JournalEntryService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('CoopFinancialReportService', () => {
    let database: Database;
    let service: typeof CoopFinancialReportService;
    let coaService: typeof ChartOfAccountsService;
    let journalService: typeof JournalEntryService;

    beforeEach(async () => {
        database = createTestDatabase();
        service = CoopFinancialReportService;
        coaService = ChartOfAccountsService;
        journalService = JournalEntryService;

        // Inject database instance
        (service as any).db = database;
        (coaService as any).db = database;
        (journalService as any).db = database;
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('should save and load period settings correctly', async () => {
        const year = 2025;
        const mockSettings = {
            authorizedShareCapital: 300000,
            subscribedCapital: 260000,
            subscriptionReceivable: 15000,
            sundryAssets: 120000,
            priorYearData: {
                cashOnHand: 35000,
                cashInBank: 50000,
            },
        };

        let settings = await service.getPeriodSettings(year);
        expect(settings).toBeNull();

        await service.savePeriodSettings(year, mockSettings, 'Tester');

        settings = await service.getPeriodSettings(year);
        expect(settings).not.toBeNull();
        expect(settings?.authorizedShareCapital).toBe(300000);
        expect(settings?.subscribedCapital).toBe(260000);
        expect(settings?.subscriptionReceivable).toBe(15000);
        expect(settings?.sundryAssets).toBe(120000);
        
        const prior = JSON.parse(settings?.priorYearData || '{}');
        expect(prior.cashOnHand).toBe(35000);
        expect(prior.cashInBank).toBe(50000);
    });

    it('should compute Balance Sheet correctly based on GL ledger', async () => {
        await coaService.seed('Tester');
        
        // Save period settings with zero starting capital so it balances
        await service.savePeriodSettings(2025, {
            authorizedShareCapital: 280000,
            subscribedCapital: 0,
            subscriptionReceivable: 0,
            sundryAssets: 0,
            priorYearData: {}
        }, 'Tester');

        // Post a transaction: Cash on Hand 10000 (DR) / Share Capital 10000 (CR)
        await journalService.createEntry({
            entryDate: new Date(2025, 5, 15),
            description: 'Capital Contribution',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 10000, description: 'Debit Cash' },
                { accountCode: '3010', creditAmount: 10000, description: 'Credit Share Capital' }
            ]
        }, 'Tester');

        const sheet = await service.getStatementOfFinancialCondition(2025);
        
        expect(sheet.assets.cashOnHand.current).toBe(10000);
        expect(sheet.equity.paidUpCapital.current).toBe(10000); // 0 start + 10000 GL balance
        expect(sheet.totalLiabilitiesAndEquity.current).toBe(sheet.assets.totalAssets.current);
    });

    it('should compute Operations Statement and allocate surplus correctly', async () => {
        await coaService.seed('Tester');

        // Post revenue and expense entries
        // DR Cash on Hand 5000 / CR Interest on Loans 5000
        await journalService.createEntry({
            entryDate: new Date(2025, 6, 20),
            description: 'Interest Collection',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 5000 },
                { accountCode: '4010', creditAmount: 5000 }
            ]
        }, 'Tester');

        // DR Salaries & Wages 2000 / CR Cash on Hand 2000
        await journalService.createEntry({
            entryDate: new Date(2025, 6, 25),
            description: 'Salary Payment',
            entryType: 'manual',
            lines: [
                { accountCode: '5010', debitAmount: 2000 },
                { accountCode: '1010', creditAmount: 2000 }
            ]
        }, 'Tester');

        const ops = await service.getStatementOfOperations(2025);
        expect(ops.revenues.totalRevenues.current).toBe(5000);
        expect(ops.expenses.totalExpenses.current).toBe(2000);
        expect(ops.netSurplus.current).toBe(3000);

        // Perform statutory allocations (Total must equal 3000)
        const allocations = [
            { type: 'reserve', percentage: 10, amount: 300 },
            { type: 'education', percentage: 10, amount: 300 },
            { type: 'union_federation', percentage: 0, amount: 0 },
            { type: 'community_dev', percentage: 3, amount: 90 },
            { type: 'optional', percentage: 7, amount: 210 },
            { type: 'interest_on_capital', percentage: 49, amount: 1470 },
            { type: 'patronage_refund', percentage: 21, amount: 630 },
        ];

        await service.allocateSurplus(2025, 3000, allocations, 'Tester');

        const equityChanges = await service.getStatementOfChangesInEquity(2025);
        const reserveFund = equityChanges.funds.find(f => f.fundType === 'reserve');
        expect(reserveFund?.ending).toBe(300);

        const optionalFund = equityChanges.funds.find(f => f.fundType === 'optional');
        expect(optionalFund?.ending).toBe(210);
    });

    // ─── Agribusiness statements ─────────────────────────────────────────────────
    //
    // AutoPostingService writes the agribusiness events to 1240/1245/1246 (biological assets and
    // produce), 2035/2036 (land-owner settlement and field-labor payables), 3015 (project equity),
    // 4140/4145 (offtake and by-product revenue) and 5160-5169 (farm production costs). The coop
    // CDA template this service was written for enumerated only the lending accounts, so every
    // agribusiness posting was invisible in the statements while the totals silently ignored it.
    // These tests pin the agri accounts into the presented lines and pin the totals as the sum of
    // the whole account class, which is what makes an omission impossible to reintroduce.

    it('presents the agribusiness accounts on the statement of financial position', async () => {
        await coaService.seed('Tester');
        await service.savePeriodSettings(2026, {
            authorizedShareCapital: 0,
            subscribedCapital: 0,
            subscriptionReceivable: 0,
            sundryAssets: 0,
            priorYearData: {},
        }, 'Tester');

        // Standing crops capitalised from the BioGreen project fund
        await journalService.createEntry({
            entryDate: new Date(2026, 2, 1),
            description: 'Crop cycle establishment — standing crops',
            entryType: 'manual',
            lines: [
                { accountCode: '1240', debitAmount: 40000 },
                { accountCode: '3015', creditAmount: 40000 },
            ],
        }, 'Tester');

        // Approved but unpaid land-owner settlement and field labour
        await journalService.createEntry({
            entryDate: new Date(2026, 3, 1),
            description: 'Weekly settlement and labor accrual',
            entryType: 'manual',
            lines: [
                { accountCode: '5160', debitAmount: 8000 },
                { accountCode: '5161', debitAmount: 2000 },
                { accountCode: '2035', creditAmount: 8000 },
                { accountCode: '2036', creditAmount: 2000 },
            ],
        }, 'Tester');

        const sheet = await service.getStatementOfFinancialCondition(2026);

        expect(sheet.assets.farmAssets.current).toBe(40000);
        expect(sheet.liabilities.settlementsPayable.current).toBe(8000);
        expect(sheet.liabilities.laborPayable.current).toBe(2000);
        expect(sheet.equity.projectEquity.current).toBe(40000);

        // The statement must still balance once the agri accounts are inside the presented totals.
        expect(sheet.assets.totalAssets.current).toBe(40000);
        expect(sheet.liabilities.totalLiabilities.current).toBe(10000);
        expect(sheet.totalLiabilitiesAndEquity.current).toBe(sheet.assets.totalAssets.current);
    });

    it('presents offtake and by-product revenue and farm production costs on the statement of operations', async () => {
        await coaService.seed('Tester');

        await journalService.createEntry({
            entryDate: new Date(2026, 6, 10),
            description: 'Harvest weigh-in invoiced to offtaker',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 12000 },
                { accountCode: '4140', creditAmount: 10000 },
                { accountCode: '4145', creditAmount: 2000 },
            ],
        }, 'Tester');

        await journalService.createEntry({
            entryDate: new Date(2026, 6, 12),
            description: 'Fertilizer and hauling paid in cash',
            entryType: 'manual',
            lines: [
                { accountCode: '5162', debitAmount: 1500 },
                { accountCode: '5167', debitAmount: 500 },
                { accountCode: '1010', creditAmount: 2000 },
            ],
        }, 'Tester');

        const ops = await service.getStatementOfOperations(2026);

        expect(ops.revenues.offtakeRevenue.current).toBe(10000);
        expect(ops.revenues.byproductRevenue.current).toBe(2000);
        expect(ops.revenues.totalRevenues.current).toBe(12000);
        expect(ops.expenses.farmProductionCosts.current).toBe(2000);
        expect(ops.expenses.totalExpenses.current).toBe(2000);
        expect(ops.netSurplus.current).toBe(10000);
    });

    it('appropriates only the four statutory funds and leaves the rest to the screen', async () => {
        await coaService.seed('Tester');

        await journalService.createEntry({
            entryDate: new Date(2026, 6, 10),
            description: 'Harvest weigh-in invoiced to offtaker',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 12000 },
                { accountCode: '4140', creditAmount: 12000 },
            ],
        }, 'Tester');

        const ops = await service.getStatementOfOperations(2026);

        // A row whose percentage is zero is not an appropriation: it only re-presents an existing
        // balance. The screen computes the retained line itself, so pseudo-rows would double-count
        // it and, because their priorAmount is read from an unrelated payable, distort the
        // comparative column.
        expect(ops.allocations.map(a => a.fundType)).toEqual([
            'Reserve Fund',
            'Education and Training Fund',
            'Community Development Fund',
            'Optional Fund',
        ]);
        expect(ops.allocations.every(a => a.percentage > 0)).toBe(true);

        const appropriated = ops.allocations.reduce((s, a) => s + a.amount, 0);
        expect(ops.netSurplus.current - appropriated).toBe(8400);
    });

    it('names no retired lending or cooperative-credit account in the presented statements', async () => {
        await coaService.seed('Tester');
        const sheet = await service.getStatementOfFinancialCondition(2027);
        const ops = await service.getStatementOfOperations(2027);
        const notes = await service.getNotesToFinancialStatements(2027);

        expect(Object.keys(sheet.assets)).not.toContain('loanReceivable');
        expect(Object.keys(sheet.liabilities)).not.toContain('depositLiabilities');
        expect(Object.keys(sheet.liabilities)).not.toContain('patronageRefundPayable');
        expect(Object.keys(sheet.liabilities)).not.toContain('interestShareCapitalPayable');
        expect(Object.keys(ops.revenues)).not.toContain('interestOnLoans');
        expect(Object.keys(ops.revenues)).not.toContain('membershipFees');
        expect(Object.keys(ops.revenues)).not.toContain('totalCreditOps');
        expect(Object.keys(notes)).not.toContain('loanNote');
        expect(notes.organizationName).not.toMatch(/POS Cursor|Cooperative/i);
    });

    it('keeps every account class represented in the class total', async () => {
        await coaService.seed('Tester');
        // 4130 is a retired marketplace sales account the enumerated template would have skipped;
        // anything posted to it must still appear inside totalRevenues.
        await journalService.createEntry({
            entryDate: new Date(2026, 8, 1),
            description: 'Legacy balance carried into the variant database',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 750 },
                { accountCode: '4130', creditAmount: 750 },
            ],
        }, 'Tester');

        const ops = await service.getStatementOfOperations(2026);
        expect(ops.revenues.otherRevenue.current).toBe(750);
        expect(ops.revenues.totalRevenues.current).toBe(750);
    });
});
