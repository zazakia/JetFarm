/**
 * FinancialDataSeedService.ts
 *
 * Seeds the 2024 and 2025 audited financial data into the local WatermelonDB.
 * Data source: CS Arriola Auditing Services reports for
 * POSCURSOR CHRISTIAN CHILDREN FUND SAVINGS AND CREDIT COOPERATIVE
 *
 * Call seedHistoricalData() from the app (e.g. Period Settings screen).
 * This runs entirely offline against the local WatermelonDB instance.
 */

import { Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import { JournalEntryServiceClass } from './JournalEntryService';
import { CoopFinancialReportServiceClass } from './CoopFinancialReportService';
import { ChartOfAccountsServiceClass } from './ChartOfAccountsService';

// ─── COA Codes ────────────────────────────────────────────────────────────
const COA = {
    CASH_ON_HAND: '1010',
    CASH_IN_BANK: '1020',
    LOANS_RECEIVABLE: '1100',
    SUNDRY_ASSETS: '1710',
    SAVINGS_DEPOSITS: '2010',
    INTEREST_SHARE_CAPITAL_PAYABLE: '2050',
    PATRONAGE_REFUND_PAYABLE: '2060',
    DUE_TO_UNION: '2070',
    SHARE_CAPITAL: '3010',
    RESERVE_FUND: '3020',
    EDUCATION_FUND: '3030',
    COMMUNITY_DEV_FUND: '3040',
    OPTIONAL_FUND: '3050',
    RETAINED_SURPLUS: '3060',
    INTEREST_ON_LOANS: '4010',
    SERVICE_FEES: '4020',
    MEMBERSHIP_FEES: '4030',
    INTEREST_ON_INVESTMENTS: '4060',
    MISCELLANEOUS_INCOME: '4070',
    FINANCING_COSTS: '5110',
    OTHER_EXPENSES: '5100',
};

export class FinancialDataSeedService {
    private db: Database;
    private journalService: JournalEntryServiceClass;
    private reportService: CoopFinancialReportServiceClass;
    private coaService: ChartOfAccountsServiceClass;

    constructor(db: Database = globalDatabase) {
        this.db = db;
        this.journalService = new JournalEntryServiceClass(db);
        this.reportService = new CoopFinancialReportServiceClass(db);
        this.coaService = new ChartOfAccountsServiceClass(db);
    }

    async isAlreadySeeded(): Promise<boolean> {
        const settings2025 = await this.reportService.getPeriodSettings(2025);
        return settings2025 !== null;
    }

    async seedHistoricalData(performedBy: string = 'Admin'): Promise<{ success: boolean; message: string }> {
        try {
            // Step 1: Ensure CoA is seeded
            const seeded = await this.coaService.isSeeded();
            if (!seeded) {
                await this.coaService.seed(performedBy);
            }

            // Step 2: Seed period settings for FY2024 and FY2025
            await this.seedPeriodSettings(performedBy);

            // Step 3: Post FY2024 Closing Audited Balance Sheet Entry
            await this.seed2024ClosingBalance(performedBy);

            // Step 4: Post FY2025 Transactions & Adjustments
            await this.seed2025Transactions(performedBy);

            // Step 5: Save statutory fund allocations
            await this.saveStatutoryAllocations(performedBy);

            return {
                success: true,
                message: 'FY2024 and FY2025 financial data successfully migrated to local database.',
            };
        } catch (err: any) {
            return {
                success: false,
                message: `Migration failed: ${err.message}`,
            };
        }
    }

    // ─── Period Settings ───────────────────────────────────────────────────

    private async seedPeriodSettings(performedBy: string) {
        // FY2025 with 2024 comparative figures
        await this.reportService.savePeriodSettings(2025, {
            authorizedShareCapital: 280000.00,
            subscribedCapital: 250000.00,
            subscriptionReceivable: 18092.73,
            sundryAssets: 121399.90,
            priorYearData: {
                // 2024 Balance Sheet figures
                cashOnHand: 39902.93,
                cashInBank: 53011.35,
                loanReceivable: 164622.70,
                sundryAssets: 117411.91,
                totalAssets: 374948.89,
                depositLiabilities: 116384.50,
                interestShareCapitalPayable: 559.15,
                patronageRefundPayable: 559.15,
                dueToUnion: 186.38,
                otherPayables: 0,
                totalCurrentLiabilities: 117689.18,
                subscribedCapital: 250000.00,
                subscriptionReceivable: 18092.73,
                reserveFund: 17094.77,
                educationFund: 1366.41,
                communityDevFund: 1647.38,
                optionalFund: 5243.88,
                retainedSurplus: 0,
                totalEquity: 257259.71,
                authorizedShareCapital: 280000.00,
                // 2024 Operations figures
                interestOnLoans: 16260.00,
                serviceCharges: 3620.00,
                penalties: 0,
                membershipFees: 0,
                interestOnInvestments: 0,
                miscellaneousIncome: 0,
                financingCosts: 6814.31,
                salaries: 0,
                office: 0,
                communication: 0,
                transportation: 0,
                depreciation: 0,
                taxes: 0,
                repairs: 0,
                training: 0,
                professional: 0,
                otherExpenses: 9338.00,
            },
        }, performedBy);

        // FY2024 with 2023 comparative (from Changes in Equity sheet)
        await this.reportService.savePeriodSettings(2024, {
            authorizedShareCapital: 280000.00,
            subscribedCapital: 250000.00,
            subscriptionReceivable: 18092.73,
            sundryAssets: 117411.91,
            priorYearData: {
                cashOnHand: 0,
                cashInBank: 0,
                loanReceivable: 0,
                sundryAssets: 0,
                totalAssets: 0,
                depositLiabilities: 0,
                interestShareCapitalPayable: 0,
                patronageRefundPayable: 0,
                dueToUnion: 0,
                otherPayables: 0,
                totalCurrentLiabilities: 0,
                subscribedCapital: 208622.34, // From 2024 Changes in Equity: beginning share capital
                subscriptionReceivable: 18092.73,
                reserveFund: 15230.91,
                educationFund: 1366.41,
                communityDevFund: 1535.55,
                optionalFund: 4982.94,
                retainedSurplus: 0,
                totalEquity: 211645.02,
                authorizedShareCapital: 280000.00,
                interestOnLoans: 0,
                serviceCharges: 0,
                penalties: 0,
                membershipFees: 0,
                interestOnInvestments: 0,
                miscellaneousIncome: 0,
                financingCosts: 0,
                salaries: 0,
                office: 0,
                communication: 0,
                transportation: 0,
                depreciation: 0,
                taxes: 0,
                repairs: 0,
                training: 0,
                professional: 0,
                otherExpenses: 0,
            },
        }, performedBy);
    }

    // ─── FY2024 Closing Audited Balance Sheet ──────────────────────────────

    private async seed2024ClosingBalance(performedBy: string) {
        const DEC31_2024 = new Date(2024, 11, 31, 23, 59, 59);

        // Single balanced journal entry representing the Dec 31, 2024 audited balance sheet
        await this.journalService.createEntry({
            entryDate: DEC31_2024,
            description: 'FY2024: Audited Balance Sheet closing balances (historical migration)',
            entryType: 'adjusting',
            fiscalYear: 2024,
            fiscalMonth: 12,
            lines: [
                // Assets (DR)
                { accountCode: COA.CASH_ON_HAND, debitAmount: 39902.93, description: 'Audited Cash on Hand' },
                { accountCode: COA.CASH_IN_BANK, debitAmount: 53011.35, description: 'Audited Cash in Bank' },
                { accountCode: COA.LOANS_RECEIVABLE, debitAmount: 164622.70, description: 'Audited Loans Receivable' },
                { accountCode: COA.SUNDRY_ASSETS, debitAmount: 117411.91, description: 'Audited Other Non-Current Assets' },
                // Liabilities (CR)
                { accountCode: COA.SAVINGS_DEPOSITS, creditAmount: 116384.50, description: 'Audited Deposit Liabilities' },
                { accountCode: COA.INTEREST_SHARE_CAPITAL_PAYABLE, creditAmount: 559.15, description: 'Audited Interest on Share Capital Payable' },
                { accountCode: COA.PATRONAGE_REFUND_PAYABLE, creditAmount: 559.15, description: 'Audited Patronage Refund Payable' },
                { accountCode: COA.DUE_TO_UNION, creditAmount: 186.38, description: 'Audited Due to Union/Federation' },
                // Equity (CR)
                { accountCode: COA.SHARE_CAPITAL, creditAmount: 231907.27, description: 'Audited Paid-up Share Capital' },
                { accountCode: COA.RESERVE_FUND, creditAmount: 17094.77, description: 'Audited Reserve Fund' },
                { accountCode: COA.EDUCATION_FUND, creditAmount: 1366.41, description: 'Audited Education and Training Fund' },
                { accountCode: COA.COMMUNITY_DEV_FUND, creditAmount: 1647.38, description: 'Audited Community Development Fund' },
                { accountCode: COA.OPTIONAL_FUND, creditAmount: 5243.88, description: 'Audited Optional Fund' },
            ],
        }, performedBy);
    }

    // ─── FY2025 Transactions & Roll-Forward ──────────────────────────────────

    private async seed2025Transactions(performedBy: string) {
        const DEC31_2025 = new Date(2025, 11, 31, 23, 59, 59);

        // 1. Interest income from loans (Note 13)
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: Income from credit operations — interest on loans',
            entryType: 'adjusting',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                { accountCode: COA.CASH_ON_HAND, debitAmount: 10500.00, description: 'Interest collections' },
                { accountCode: COA.INTEREST_ON_LOANS, creditAmount: 10500.00, description: 'Interest on loans income' },
            ],
        }, performedBy);

        // 2. Service fees (Note 13)
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: Service fees collected',
            entryType: 'adjusting',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                { accountCode: COA.CASH_ON_HAND, debitAmount: 2300.00, description: 'Service fee collections' },
                { accountCode: COA.SERVICE_FEES, creditAmount: 2300.00, description: 'Service fees income' },
            ],
        }, performedBy);

        // 3. Other income — membership fees, investments, misc (Note 14)
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: Other income — membership, investments, miscellaneous',
            entryType: 'adjusting',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                { accountCode: COA.CASH_ON_HAND, debitAmount: 328.62, description: 'Other income received' },
                { accountCode: COA.MEMBERSHIP_FEES, creditAmount: 200.00, description: 'Membership fees collected' },
                { accountCode: COA.INTEREST_ON_INVESTMENTS, creditAmount: 78.62, description: 'Interest on bank deposits' },
                { accountCode: COA.MISCELLANEOUS_INCOME, creditAmount: 50.00, description: 'Miscellaneous income' },
            ],
        }, performedBy);

        // 4. Financing costs — interest on savings deposits (Note 15)
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: Financing costs — interest on member deposits @ 6% p.a.',
            entryType: 'adjusting',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                { accountCode: COA.FINANCING_COSTS, debitAmount: 7334.57, description: 'Interest expense on savings deposits' },
                { accountCode: COA.SAVINGS_DEPOSITS, creditAmount: 7334.57, description: 'Accrued interest on member deposits' },
            ],
        }, performedBy);

        // 5. Administrative costs (Note 16)
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: Administrative costs',
            entryType: 'adjusting',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                { accountCode: COA.OTHER_EXPENSES, debitAmount: 7308.00, description: 'Administrative and operating expenses' },
                { accountCode: COA.CASH_ON_HAND, creditAmount: 7308.00, description: 'Cash disbursed for admin costs' },
            ],
        }, performedBy);

        // 6. Savings deposits net receipts (excluding interest)
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: Savings deposits net member deposits',
            entryType: 'adjusting',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                { accountCode: COA.CASH_ON_HAND, debitAmount: 23823.78, description: 'Net member deposits' },
                { accountCode: COA.SAVINGS_DEPOSITS, creditAmount: 23823.78, description: 'Net savings deposits' },
            ],
        }, performedBy);

        // 7. Loans Receivable net collections
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: Loans receivable net collections',
            entryType: 'adjusting',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                { accountCode: COA.CASH_ON_HAND, debitAmount: 10100.00, description: 'Net loan collections' },
                { accountCode: COA.LOANS_RECEIVABLE, creditAmount: 10100.00, description: 'Net decrease in loan portfolio' },
            ],
        }, performedBy);

        // 8. Sundry Assets net increase/purchase
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: Sundry assets net purchases',
            entryType: 'adjusting',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                { accountCode: COA.SUNDRY_ASSETS, debitAmount: 3987.99, description: 'Net sundry additions' },
                { accountCode: COA.CASH_ON_HAND, creditAmount: 3987.99, description: 'Sundry purchases payment' },
            ],
        }, performedBy);

        // 9. Education Fund Program Disbursement
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: Education fund program disbursement',
            entryType: 'adjusting',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                { accountCode: COA.EDUCATION_FUND, debitAmount: 1366.41, description: 'Payments for cooperative education program' },
                { accountCode: COA.CASH_ON_HAND, creditAmount: 1366.41, description: 'Education fund payment' },
            ],
        }, performedBy);

        // 10. Cash in Bank net BDO deposits
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: BDO bank account net deposits',
            entryType: 'adjusting',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                { accountCode: COA.CASH_IN_BANK, debitAmount: 208.98, description: 'Net BDO bank deposit' },
                { accountCode: COA.CASH_ON_HAND, creditAmount: 208.98, description: 'BDO deposit' },
            ],
        }, performedBy);

        // 11. Reserve Fund rounding adjustment
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: Reserve fund rounding adjustments',
            entryType: 'adjusting',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                { accountCode: COA.RESERVE_FUND, debitAmount: 0.02, description: 'Reserve fund rounding' },
                { accountCode: COA.CASH_ON_HAND, creditAmount: 0.02, description: 'Rounding' },
            ],
        }, performedBy);

        // 12. Income statement closing entry to Retained Surplus (Net Loss of 1,513.95)
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: Closing entry — net operating loss close to Retained Surplus',
            entryType: 'closing',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                // Close revenues (debit)
                { accountCode: COA.INTEREST_ON_LOANS, debitAmount: 10500.00, description: 'Close interest income' },
                { accountCode: COA.SERVICE_FEES, debitAmount: 2300.00, description: 'Close service fees' },
                { accountCode: COA.MEMBERSHIP_FEES, debitAmount: 200.00, description: 'Close membership fees' },
                { accountCode: COA.INTEREST_ON_INVESTMENTS, debitAmount: 78.62, description: 'Close investment income' },
                { accountCode: COA.MISCELLANEOUS_INCOME, debitAmount: 50.00, description: 'Close misc income' },
                // Retained Surplus debit for the net loss
                { accountCode: COA.RETAINED_SURPLUS, debitAmount: 1513.95, description: 'Operating Net Loss' },
                // Close expenses (credit)
                { accountCode: COA.FINANCING_COSTS, creditAmount: 7334.57, description: 'Close financing costs' },
                { accountCode: COA.OTHER_EXPENSES, creditAmount: 7308.00, description: 'Close administrative costs' },
            ],
        }, performedBy);

        // 13. Loss absorption from Reserve Fund
        await this.journalService.createEntry({
            entryDate: DEC31_2025,
            description: 'FY2025: Reserve fund net loss absorption per RA 9520',
            entryType: 'closing',
            fiscalYear: 2025,
            fiscalMonth: 12,
            lines: [
                { accountCode: COA.RESERVE_FUND, debitAmount: 1513.95, description: 'Net loss absorbed by Reserve Fund' },
                { accountCode: COA.RETAINED_SURPLUS, creditAmount: 1513.95, description: 'Absorption of Net Loss' },
            ],
        }, performedBy);
    }

    // ─── Statutory Fund Allocations ───────────────────────────────────────

    private async saveStatutoryAllocations(performedBy: string) {
        // FY2024: Net Surplus 3,727.69
        await this.reportService.allocateSurplus(
            2024,
            3727.69,
            [
                { type: 'reserve',            percentage: 50, amount: 1863.85 },
                { type: 'education',           percentage:  5, amount:  186.38 },
                { type: 'union_federation',    percentage:  5, amount:  186.38 },
                { type: 'community_dev',       percentage:  3, amount:  111.83 },
                { type: 'optional',            percentage:  7, amount:  260.94 },
                { type: 'interest_on_capital', percentage: 15, amount:  559.15 },
                { type: 'patronage_refund',    percentage: 15, amount:  559.16 },
            ],
            performedBy
        ).catch(() => { /* skip if already allocated */ });

        // FY2025: Net Loss (1,513.95) absorbed 100% by reserve fund
        await this.reportService.allocateSurplus(
            2025,
            -1513.95,
            [
                { type: 'reserve', percentage: 100, amount: -1513.95 },
            ],
            performedBy
        ).catch(() => { /* skip if already allocated */ });
    }
}

export const FinancialDataSeed = new FinancialDataSeedService();
