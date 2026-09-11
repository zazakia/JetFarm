import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import ChartOfAccount from '../database/models/ChartOfAccount';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';
import StatutoryFundAllocation from '../database/models/StatutoryFundAllocation';
import FinancialPeriodSetting from '../database/models/FinancialPeriodSetting';
import ActionLogService from './ActionLogService';
import { JournalEntryServiceClass } from './JournalEntryService';
import { AutoPostingService } from './AutoPostingService';


export interface CdaComparativeAmount {
    current: number;
    prior: number;
    variance: number;
}

export interface CdaBalanceSheet {
    year: number;
    priorYear: number;
    asOf: Date;
    assets: {
        cashOnHand: CdaComparativeAmount;
        cashInBank: CdaComparativeAmount;
        loanReceivable: CdaComparativeAmount;
        totalCurrentAssets: CdaComparativeAmount;
        sundryAssets: CdaComparativeAmount;
        totalNonCurrentAssets: CdaComparativeAmount;
        totalAssets: CdaComparativeAmount;
    };
    liabilities: {
        depositLiabilities: CdaComparativeAmount;
        interestShareCapitalPayable: CdaComparativeAmount;
        patronageRefundPayable: CdaComparativeAmount;
        dueToUnion: CdaComparativeAmount;
        totalCurrentLiabilities: CdaComparativeAmount;
        totalLiabilities: CdaComparativeAmount;
    };
    equity: {
        authorizedCapital: number; // Config values for current year
        priorAuthorizedCapital: number; // Config values for prior year
        subscribedCapital: CdaComparativeAmount;
        subscriptionReceivable: CdaComparativeAmount;
        paidUpCapital: CdaComparativeAmount;
        reserveFund: CdaComparativeAmount;
        educationFund: CdaComparativeAmount;
        communityDevFund: CdaComparativeAmount;
        optionalFund: CdaComparativeAmount;
        totalStatutoryFunds: CdaComparativeAmount;
        retainedSurplus: CdaComparativeAmount;
        totalEquity: CdaComparativeAmount;
    };
    totalLiabilitiesAndEquity: CdaComparativeAmount;
}

export interface CdaOperationsStatement {
    year: number;
    priorYear: number;
    revenues: {
        interestOnLoans: CdaComparativeAmount;
        serviceCharges: CdaComparativeAmount;
        penalties: CdaComparativeAmount;
        totalCreditOps: CdaComparativeAmount;
        membershipFees: CdaComparativeAmount;
        interestOnInvestments: CdaComparativeAmount;
        miscellaneousIncome: CdaComparativeAmount;
        totalOtherIncome: CdaComparativeAmount;
        totalRevenues: CdaComparativeAmount;
    };
    expenses: {
        financingCosts: CdaComparativeAmount; // Interest on deposits
        salaries: CdaComparativeAmount;
        office: CdaComparativeAmount;
        communication: CdaComparativeAmount;
        transportation: CdaComparativeAmount;
        depreciation: CdaComparativeAmount;
        taxes: CdaComparativeAmount;
        repairs: CdaComparativeAmount;
        training: CdaComparativeAmount;
        professional: CdaComparativeAmount;
        otherExpenses: CdaComparativeAmount;
        totalAdminCosts: CdaComparativeAmount;
        totalExpenses: CdaComparativeAmount;
    };
    netSurplus: CdaComparativeAmount;
    allocations: {
        fundType: string;
        percentage: number;
        amount: number;
        priorAmount: number;
    }[];
}

export interface CdaEquityChanges {
    year: number;
    shareCapital: {
        beginning: number;
        additions: number;
        ending: number;
        priorBeginning: number;
        priorAdditions: number;
        priorEnding: number;
    };
    funds: {
        name: string;
        fundType: string;
        beginning: number;
        additions: number;
        deductions: number;
        ending: number;
        priorBeginning: number;
        priorAdditions: number;
        priorDeductions: number;
        priorEnding: number;
    }[];
    totalStatutoryFunds: {
        beginning: number;
        ending: number;
        priorBeginning: number;
        priorEnding: number;
    };
    totalEquity: {
        beginning: number;
        ending: number;
        priorBeginning: number;
        priorEnding: number;
    };
}

export interface CdaNotes {
    organizationName: string;
    organizationAddress: string;
    registrationNumber: string;
    dateRegistered: string;
    cashNote: {
        cashOnHand: number;
        cashInBank: number;
        total: number;
    };
    loanNote: {
        outstandingLoans: number;
        allowance: number;
        net: number;
        pastDue: number;
        current: number;
    };
    statutoryNote: {
        reserveFund: number;
        educationFund: number;
        communityDevFund: number;
        optionalFund: number;
        total: number;
    };
}

export interface PriorYearData {
    cashOnHand?: number;
    cashInBank?: number;
    loanReceivable?: number;
    sundryAssets?: number;
    totalAssets?: number;
    depositLiabilities?: number;
    interestShareCapitalPayable?: number;
    patronageRefundPayable?: number;
    dueToUnion?: number;
    otherPayables?: number;
    totalCurrentLiabilities?: number;
    subscribedCapital?: number;
    subscriptionReceivable?: number;
    reserveFund?: number;
    educationFund?: number;
    communityDevFund?: number;
    optionalFund?: number;
    retainedSurplus?: number;
    totalEquity?: number;
    authorizedShareCapital?: number;

    interestOnLoans?: number;
    serviceCharges?: number;
    penalties?: number;
    membershipFees?: number;
    interestOnInvestments?: number;
    miscellaneousIncome?: number;
    financingCosts?: number;
    salaries?: number;
    office?: number;
    communication?: number;
    transportation?: number;
    depreciation?: number;
    taxes?: number;
    repairs?: number;
    training?: number;
    professional?: number;
    otherExpenses?: number;
}


export class CoopFinancialReportServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    // ─── GL Balance Aggregation helper ──────────────────────────────────────────

    private async getGLBalances(asOf: Date, businessUnitId?: string): Promise<Map<string, number>> {
        // Ensure all unposted operational transactions in the DB have been auto-posted to GL
        try {
            await AutoPostingService.backfillUnpostedTransactions();
        } catch (e) {
            console.warn('[CoopFinancialReportService] Auto-posting backfill error:', e);
        }

        const balances = new Map<string, number>();
        const asOfMs = asOf.getTime();

        // 1. Fetch all posted, undeleted journal entries <= asOf
        const entries = await this.db.collections
            .get<JournalEntry>('journal_entries')
            .query(
                Q.where('entry_date', Q.lte(asOfMs)),
                Q.where('is_posted', true),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();


        const entryIds = entries.map(e => e.id);
        if (entryIds.length === 0) return balances;

        // 2. Fetch all lines for these entries
        const clauses: Q.Clause[] = [
            Q.where('journal_entry_id', Q.oneOf(entryIds)),
            Q.where('deleted_at', Q.eq(null))
        ];

        if (businessUnitId) {
            clauses.push(Q.where('business_unit_id', businessUnitId));
        }

        const lines = await this.db.collections
            .get<JournalEntryLine>('journal_entry_lines')
            .query(...clauses)
            .fetch();

        // 3. Aggregate debits and credits per account code
        const aggregates = new Map<string, { dr: number; cr: number }>();
        for (const line of lines) {
            if (!aggregates.has(line.accountCode)) {
                aggregates.set(line.accountCode, { dr: 0, cr: 0 });
            }
            const agg = aggregates.get(line.accountCode)!;
            agg.dr += line.debitAmount ?? 0;
            agg.cr += line.creditAmount ?? 0;
        }

        // 4. Fetch all accounts to determine normal balance
        const accounts = await this.db.collections
            .get<ChartOfAccount>('chart_of_accounts')
            .query(Q.where('deleted_at', Q.eq(null)))
            .fetch();

        for (const account of accounts) {
            const agg = aggregates.get(account.code) ?? { dr: 0, cr: 0 };
            const balance = account.normalBalance === 'debit'
                ? agg.dr - agg.cr
                : agg.cr - agg.dr;
            balances.set(account.code, balance);
        }

        return balances;
    }

    // ─── Period Settings & Comparative Data ──────────────────────────────────────

    async getPeriodSettings(year: number): Promise<FinancialPeriodSetting | null> {
        const results = await this.db.collections
            .get<FinancialPeriodSetting>('financial_period_settings')
            .query(
                Q.where('fiscal_year', year),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();
        return results.length > 0 ? results[0] : null;
    }

    async savePeriodSettings(
        year: number,
        settings: {
            authorizedShareCapital: number;
            subscribedCapital: number;
            subscriptionReceivable: number;
            sundryAssets: number;
            priorYearData: PriorYearData;
        },
        performedBy?: string
    ): Promise<FinancialPeriodSetting> {
        const existing = await this.getPeriodSettings(year);
        let record: FinancialPeriodSetting;

        await this.db.write(async () => {
            if (existing) {
                record = await existing.update(r => {
                    r.authorizedShareCapital = settings.authorizedShareCapital;
                    r.subscribedCapital = settings.subscribedCapital;
                    r.subscriptionReceivable = settings.subscriptionReceivable;
                    r.sundryAssets = settings.sundryAssets;
                    r.priorYearData = JSON.stringify(settings.priorYearData);
                });
            } else {
                record = await this.db.collections
                    .get<FinancialPeriodSetting>('financial_period_settings')
                    .create(r => {
                        r.fiscalYear = year;
                        r.authorizedShareCapital = settings.authorizedShareCapital;
                        r.subscribedCapital = settings.subscribedCapital;
                        r.subscriptionReceivable = settings.subscriptionReceivable;
                        r.sundryAssets = settings.sundryAssets;
                        r.priorYearData = JSON.stringify(settings.priorYearData);
                    });
            }
        });

        if (performedBy) {
            await ActionLogService.logAction({
                entityType: 'financial_period_settings',
                entityId: record!.id,
                action: existing ? 'UPDATE' : 'CREATE',
                newData: settings,
                performedBy,
            });
        }

        return record!;
    }

    // ─── Statement of Financial Condition (Balance Sheet) ────────────────────────

    async getStatementOfFinancialCondition(year: number, businessUnitId?: string): Promise<CdaBalanceSheet> {
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
        const balances = await this.getGLBalances(endOfYear, businessUnitId);
        const periodSettings = await this.getPeriodSettings(year);

        const authorizedCapital = periodSettings?.authorizedShareCapital ?? 280000;
        const subscribedCapital = periodSettings?.subscribedCapital ?? 250000;
        const subscriptionReceivable = periodSettings?.subscriptionReceivable ?? 18092.73;

        // Parse prior year comparative data
        const prior: PriorYearData = periodSettings?.priorYearData
            ? JSON.parse(periodSettings.priorYearData)
            : {};

        // Helper to format comparative amount
        const makeComp = (currVal: number, priorVal: number): CdaComparativeAmount => {
            const current = Math.round(currVal * 100) / 100;
            const pVal = Math.round((priorVal ?? 0) * 100) / 100;
            return {
                current,
                prior: pVal,
                variance: Math.round((current - pVal) * 100) / 100,
            };
        };

        // Assets
        const cashOnHand = balances.get('1010') ?? 0;
        const cashInBank = (balances.get('1020') ?? 0) + (balances.get('1030') ?? 0) + (balances.get('1040') ?? 0);
        const loanReceivable = (balances.get('1100') ?? 0) + (balances.get('1200') ?? 0) - (balances.get('1110') ?? 0);
        const sundryAssets = balances.get('1710') ?? (periodSettings?.sundryAssets ?? 0);

        const totalCurrentAssetsVal = cashOnHand + cashInBank + loanReceivable;
        const totalNonCurrentAssetsVal = sundryAssets;
        const totalAssetsVal = totalCurrentAssetsVal + totalNonCurrentAssetsVal;

        // Liabilities
        const depositLiabilities = balances.get('2010') ?? 0;
        const interestShareCapitalPayable = balances.get('2050') ?? 0;
        const patronageRefundPayable = balances.get('2060') ?? 0;
        const dueToUnion = balances.get('2070') ?? 0;
        const otherPayables = (balances.get('2020') ?? 0) + (balances.get('2030') ?? 0) + (balances.get('2040') ?? 0) + (balances.get('2100') ?? 0);

        const totalCurrentLiabilitiesVal = depositLiabilities + interestShareCapitalPayable + patronageRefundPayable + dueToUnion + otherPayables;

        // Equity
        const shareCapitalGL = balances.get('3010') ?? 0;
        const paidUpCapitalVal = shareCapitalGL || (subscribedCapital - subscriptionReceivable);

        const reserveFund = balances.get('3020') ?? 0;
        const educationFund = balances.get('3030') ?? 0;
        const communityDevFund = balances.get('3040') ?? 0;
        const optionalFund = balances.get('3050') ?? 0;
        const totalStatutoryFundsVal = reserveFund + educationFund + communityDevFund + optionalFund;

        // Retained Surplus: combine the 3060 GL balance with unclosed net surplus.
        // The seed uses IS clearing entries that debit 3060 when there is a surplus
        // (and credit when there is a loss), so balances.get('3060') = -(net income).
        // Adding unclosedNetSurplus (= rev - exp from 4xxx/5xxx accounts) cancels this out,
        // yielding 0 when all surplus was distributed - matching the audited spreadsheet.
        let unclosedNetSurplus = 0;
        for (const [code, bal] of balances.entries()) {
            if (code.startsWith('4')) unclosedNetSurplus += bal;
            if (code.startsWith('5')) unclosedNetSurplus -= bal;
        }
        const retainedSurplus = (balances.get('3060') ?? 0) + unclosedNetSurplus;
        const totalEquityVal = paidUpCapitalVal + totalStatutoryFundsVal + retainedSurplus;

        return {
            year,
            priorYear: year - 1,
            asOf: endOfYear,
            assets: {
                cashOnHand: makeComp(cashOnHand, prior.cashOnHand ?? 0),
                cashInBank: makeComp(cashInBank, prior.cashInBank ?? 0),
                loanReceivable: makeComp(loanReceivable, prior.loanReceivable ?? 0),
                totalCurrentAssets: makeComp(totalCurrentAssetsVal, (prior.cashOnHand ?? 0) + (prior.cashInBank ?? 0) + (prior.loanReceivable ?? 0)),
                sundryAssets: makeComp(sundryAssets, prior.sundryAssets ?? 0),
                totalNonCurrentAssets: makeComp(totalNonCurrentAssetsVal, prior.sundryAssets ?? 0),
                totalAssets: makeComp(totalAssetsVal, prior.totalAssets ?? ((prior.cashOnHand ?? 0) + (prior.cashInBank ?? 0) + (prior.loanReceivable ?? 0) + (prior.sundryAssets ?? 0))),
            },
            liabilities: {
                depositLiabilities: makeComp(depositLiabilities, prior.depositLiabilities ?? 0),
                interestShareCapitalPayable: makeComp(interestShareCapitalPayable, prior.interestShareCapitalPayable ?? 0),
                patronageRefundPayable: makeComp(patronageRefundPayable, prior.patronageRefundPayable ?? 0),
                dueToUnion: makeComp(dueToUnion, prior.dueToUnion ?? 0),
                totalCurrentLiabilities: makeComp(totalCurrentLiabilitiesVal, prior.totalCurrentLiabilities ?? ((prior.depositLiabilities ?? 0) + (prior.interestShareCapitalPayable ?? 0) + (prior.patronageRefundPayable ?? 0) + (prior.dueToUnion ?? 0) + (prior.otherPayables ?? 0))),
                totalLiabilities: makeComp(totalCurrentLiabilitiesVal, prior.totalCurrentLiabilities ?? ((prior.depositLiabilities ?? 0) + (prior.interestShareCapitalPayable ?? 0) + (prior.patronageRefundPayable ?? 0) + (prior.dueToUnion ?? 0) + (prior.otherPayables ?? 0))),
            },
            equity: {
                authorizedCapital,
                priorAuthorizedCapital: prior.authorizedShareCapital ?? 280000,
                subscribedCapital: makeComp(subscribedCapital, prior.subscribedCapital ?? 250000),
                subscriptionReceivable: makeComp(subscriptionReceivable, prior.subscriptionReceivable ?? 18092.73),
                paidUpCapital: makeComp(paidUpCapitalVal, prior.subscribedCapital ? (prior.subscribedCapital - (prior.subscriptionReceivable ?? 0)) : 231907.27),
                reserveFund: makeComp(reserveFund, prior.reserveFund ?? 0),
                educationFund: makeComp(educationFund, prior.educationFund ?? 0),
                communityDevFund: makeComp(communityDevFund, prior.communityDevFund ?? 0),
                optionalFund: makeComp(optionalFund, prior.optionalFund ?? 0),
                totalStatutoryFunds: makeComp(totalStatutoryFundsVal, (prior.reserveFund ?? 0) + (prior.educationFund ?? 0) + (prior.communityDevFund ?? 0) + (prior.optionalFund ?? 0)),
                retainedSurplus: makeComp(retainedSurplus, prior.retainedSurplus ?? 0),
                totalEquity: makeComp(totalEquityVal, prior.totalEquity ?? ((prior.subscribedCapital ? (prior.subscribedCapital - (prior.subscriptionReceivable ?? 0)) : 231907.27) + (prior.reserveFund ?? 0) + (prior.educationFund ?? 0) + (prior.communityDevFund ?? 0) + (prior.optionalFund ?? 0) + (prior.retainedSurplus ?? 0))),
            },
            totalLiabilitiesAndEquity: makeComp(
                totalCurrentLiabilitiesVal + totalEquityVal,
                prior.totalAssets ?? ((prior.cashOnHand ?? 0) + (prior.cashInBank ?? 0) + (prior.loanReceivable ?? 0) + (prior.sundryAssets ?? 0))
            ),
        };
    }

    // ─── Statement of Operations (Income / Surplus) ──────────────────────────────

    async getStatementOfOperations(year: number, businessUnitId?: string): Promise<CdaOperationsStatement> {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
        
        // Compute balances at start of year and end of year
        const startBalances = await this.getGLBalances(startOfYear, businessUnitId);
        const endBalances = await this.getGLBalances(endOfYear, businessUnitId);
        const periodSettings = await this.getPeriodSettings(year);
        
        const prior: PriorYearData = periodSettings?.priorYearData
            ? JSON.parse(periodSettings.priorYearData)
            : {};

        const makeComp = (currVal: number, priorVal: number): CdaComparativeAmount => {
            const current = Math.round(currVal * 100) / 100;
            const pVal = Math.round((priorVal ?? 0) * 100) / 100;
            return {
                current,
                prior: pVal,
                variance: Math.round((current - pVal) * 100) / 100,
            };
        };

        const getPeriodActivity = (code: string): number => {
            const end = endBalances.get(code) ?? 0;
            const start = startBalances.get(code) ?? 0;
            return end - start;
        };

        // Revenues
        const interestOnLoans = getPeriodActivity('4010');
        const serviceCharges = getPeriodActivity('4020');
        const penalties = getPeriodActivity('4040');
        const totalCreditOpsVal = interestOnLoans + serviceCharges + penalties;

        const membershipFees = getPeriodActivity('4030');
        const interestOnInvestments = getPeriodActivity('4050');
        const miscellaneousIncome = getPeriodActivity('4070') + getPeriodActivity('4060');
        const totalOtherIncomeVal = membershipFees + interestOnInvestments + miscellaneousIncome;
        const totalRevenuesVal = totalCreditOpsVal + totalOtherIncomeVal;

        // Expenses
        const financingCosts = getPeriodActivity('5110'); // Interest on deposit liabilities

        const salaries = getPeriodActivity('5010');
        const office = getPeriodActivity('5020');
        const communication = getPeriodActivity('5030');
        const transportation = getPeriodActivity('5040');
        const depreciation = getPeriodActivity('5050');
        const taxes = getPeriodActivity('5060');
        const repairs = getPeriodActivity('5070');
        const training = getPeriodActivity('5080');
        const professional = getPeriodActivity('5090');
        const otherExpenses = getPeriodActivity('5100');

        const totalAdminCostsVal = salaries + office + communication + transportation + depreciation + taxes + repairs + training + professional + otherExpenses;
        const totalExpensesVal = financingCosts + totalAdminCostsVal;

        const netSurplusVal = totalRevenuesVal - totalExpensesVal;

        // Statutory Allocations details
        const allocations = await this.db.collections
            .get<StatutoryFundAllocation>('statutory_fund_allocations')
            .query(Q.where('fiscal_year', year), Q.where('deleted_at', Q.eq(null)))
            .fetch();

        const allocationRows = [
            { type: 'reserve', label: 'Reserve Fund', defaultPct: 10 },
            { type: 'education', label: 'Education and Training Fund', defaultPct: 10 },
            { type: 'community_dev', label: 'Community Development Fund', defaultPct: 3 },
            { type: 'optional', label: 'Optional Fund', defaultPct: 7 },
            { type: 'interest_on_capital', label: 'Interest on Share Capital Payable', defaultPct: 49 },
            { type: 'patronage_refund', label: 'Patronage Refund Payable', defaultPct: 21 },
        ].map(item => {
            const found = allocations.find(a => a.fundType === item.type);
            const percentage = found ? found.percentage : item.defaultPct;
            const amount = found ? found.amount : Math.round(netSurplusVal * (percentage / 100) * 100) / 100;
            
            // Prior year allocation from JSON
            let priorAmount = 0;
            if (item.type === 'reserve') priorAmount = prior.reserveFund ?? 0;
            else if (item.type === 'education') priorAmount = prior.educationFund ?? 0;
            else if (item.type === 'community_dev') priorAmount = prior.communityDevFund ?? 0;
            else if (item.type === 'optional') priorAmount = prior.optionalFund ?? 0;
            else if (item.type === 'interest_on_capital') priorAmount = prior.interestShareCapitalPayable ?? 0;
            else if (item.type === 'patronage_refund') priorAmount = prior.patronageRefundPayable ?? 0;

            return {
                fundType: item.label,
                percentage,
                amount,
                priorAmount,
            };
        });

        return {
            year,
            priorYear: year - 1,
            revenues: {
                interestOnLoans: makeComp(interestOnLoans, prior.interestOnLoans ?? 0),
                serviceCharges: makeComp(serviceCharges, prior.serviceCharges ?? 0),
                penalties: makeComp(penalties, prior.penalties ?? 0),
                totalCreditOps: makeComp(totalCreditOpsVal, (prior.interestOnLoans ?? 0) + (prior.serviceCharges ?? 0) + (prior.penalties ?? 0)),
                membershipFees: makeComp(membershipFees, prior.membershipFees ?? 0),
                interestOnInvestments: makeComp(interestOnInvestments, prior.interestOnInvestments ?? 0),
                miscellaneousIncome: makeComp(miscellaneousIncome, prior.miscellaneousIncome ?? 0),
                totalOtherIncome: makeComp(totalOtherIncomeVal, (prior.membershipFees ?? 0) + (prior.interestOnInvestments ?? 0) + (prior.miscellaneousIncome ?? 0)),
                totalRevenues: makeComp(totalRevenuesVal, (prior.interestOnLoans ?? 0) + (prior.serviceCharges ?? 0) + (prior.penalties ?? 0) + (prior.membershipFees ?? 0) + (prior.interestOnInvestments ?? 0) + (prior.miscellaneousIncome ?? 0)),
            },
            expenses: {
                financingCosts: makeComp(financingCosts, prior.financingCosts ?? 0),
                salaries: makeComp(salaries, prior.salaries ?? 0),
                office: makeComp(office, prior.office ?? 0),
                communication: makeComp(communication, prior.communication ?? 0),
                transportation: makeComp(transportation, prior.transportation ?? 0),
                depreciation: makeComp(depreciation, prior.depreciation ?? 0),
                taxes: makeComp(taxes, prior.taxes ?? 0),
                repairs: makeComp(repairs, prior.repairs ?? 0),
                training: makeComp(training, prior.training ?? 0),
                professional: makeComp(professional, prior.professional ?? 0),
                otherExpenses: makeComp(otherExpenses, prior.otherExpenses ?? 0),
                totalAdminCosts: makeComp(totalAdminCostsVal, (prior.salaries ?? 0) + (prior.office ?? 0) + (prior.communication ?? 0) + (prior.transportation ?? 0) + (prior.depreciation ?? 0) + (prior.taxes ?? 0) + (prior.repairs ?? 0) + (prior.training ?? 0) + (prior.professional ?? 0) + (prior.otherExpenses ?? 0)),
                totalExpenses: makeComp(totalExpensesVal, (prior.financingCosts ?? 0) + ((prior.salaries ?? 0) + (prior.office ?? 0) + (prior.communication ?? 0) + (prior.transportation ?? 0) + (prior.depreciation ?? 0) + (prior.taxes ?? 0) + (prior.repairs ?? 0) + (prior.training ?? 0) + (prior.professional ?? 0) + (prior.otherExpenses ?? 0))),
            },
            netSurplus: makeComp(netSurplusVal, prior.interestOnLoans ? ((prior.interestOnLoans ?? 0) + (prior.serviceCharges ?? 0) + (prior.penalties ?? 0) + (prior.membershipFees ?? 0) + (prior.interestOnInvestments ?? 0) + (prior.miscellaneousIncome ?? 0)) - ((prior.financingCosts ?? 0) + ((prior.salaries ?? 0) + (prior.office ?? 0) + (prior.communication ?? 0) + (prior.transportation ?? 0) + (prior.depreciation ?? 0) + (prior.taxes ?? 0) + (prior.repairs ?? 0) + (prior.training ?? 0) + (prior.professional ?? 0) + (prior.otherExpenses ?? 0))) : 0),
            allocations: allocationRows,
        };
    }

    // ─── Statement of Changes in Equity ──────────────────────────────────────────

    async getStatementOfChangesInEquity(year: number): Promise<CdaEquityChanges> {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
        
        const startBalances = await this.getGLBalances(startOfYear);
        const endBalances = await this.getGLBalances(endOfYear);
        const periodSettings = await this.getPeriodSettings(year);
        
        const prior: PriorYearData = periodSettings?.priorYearData
            ? JSON.parse(periodSettings.priorYearData)
            : {};

        const getPeriodActivity = (code: string): number => {
            const end = endBalances.get(code) ?? 0;
            const start = startBalances.get(code) ?? 0;
            return end - start;
        };

        const subscribedCapital = periodSettings?.subscribedCapital ?? 250000;
        const subscriptionReceivable = periodSettings?.subscriptionReceivable ?? 18092.73;

        // Share Capital Ending Balance: use GL balance directly (not formula + GL)
        const endingShareCapital = endBalances.get('3010') ?? (subscribedCapital - subscriptionReceivable);
        const beginningShareCapital = startBalances.get('3010') ?? (subscribedCapital - subscriptionReceivable);
        const additionsShareCapital = endingShareCapital - beginningShareCapital;

        // Prior Share Capital figures
        const priorEndingShareCapital = prior.subscribedCapital ? (prior.subscribedCapital - (prior.subscriptionReceivable ?? 0)) : 231907.27;
        const priorBeginningShareCapital = prior.authorizedShareCapital ?? 208622.34;
        const priorAdditionsShareCapital = priorEndingShareCapital - priorBeginningShareCapital;

        // Allocate and track individual statutory funds
        const allocations = await this.db.collections
            .get<StatutoryFundAllocation>('statutory_fund_allocations')
            .query(Q.where('fiscal_year', year), Q.where('deleted_at', Q.eq(null)))
            .fetch();

        const getAllocationAmount = (type: string, defaultPct: number): number => {
            const found = allocations.find(a => a.fundType === type);
            if (found) return found.amount;
            // Fallback: estimate from net surplus
            const interest = getPeriodActivity('4010') + getPeriodActivity('4020') + getPeriodActivity('4040');
            const other = getPeriodActivity('4030') + getPeriodActivity('4050') + getPeriodActivity('4070') + getPeriodActivity('4060');
            const rev = interest + other;
            const exp = getPeriodActivity('5110') + getPeriodActivity('5010') + getPeriodActivity('5020') + getPeriodActivity('5030') + getPeriodActivity('5040') + getPeriodActivity('5050') + getPeriodActivity('5060') + getPeriodActivity('5070') + getPeriodActivity('5080') + getPeriodActivity('5090') + getPeriodActivity('5100');
            const netSurplus = rev - exp;
            return Math.round(netSurplus * (defaultPct / 100) * 100) / 100;
        };

        const fundsList = [
            { name: 'RESERVE FUNDS', type: 'reserve', code: '3020', defaultPct: 10, priorBeg: 17094.76, priorAdd: 1863.85, priorDed: 0 },
            { name: 'EDUCATION AND TRAINING FUND', type: 'education', code: '3030', defaultPct: 10, priorBeg: 1366.41, priorAdd: 186.38, priorDed: 186.38 },
            { name: 'COMMUNITY DEVELOPMENT FUND', type: 'community_dev', code: '3040', defaultPct: 3, priorBeg: 1647.38, priorAdd: 111.83, priorDed: 111.83 },
            { name: 'OPTIONAL FUND', type: 'optional', code: '3050', defaultPct: 7, priorBeg: 5243.88, priorAdd: 260.94, priorDed: 260.94 },
        ];

        const funds = fundsList.map(f => {
            const beginning = startBalances.get(f.code) ?? 0;
            const ending = endBalances.get(f.code) ?? 0;
            const additions = getAllocationAmount(f.type, f.defaultPct);
            const deductions = Math.round((beginning + additions - ending) * 100) / 100;

            let priorBeg = f.priorBeg;
            let priorAdd = f.priorAdd;
            let priorDed = f.priorDed;
            if (prior.subscribedCapital) {
                // If user entered custom comparative figures
                if (f.type === 'reserve') { priorBeg = prior.reserveFund ?? 0; priorAdd = 0; priorDed = 0; }
                else if (f.type === 'education') { priorBeg = prior.educationFund ?? 0; priorAdd = 0; priorDed = 0; }
                else if (f.type === 'community_dev') { priorBeg = prior.communityDevFund ?? 0; priorAdd = 0; priorDed = 0; }
                else if (f.type === 'optional') { priorBeg = prior.optionalFund ?? 0; priorAdd = 0; priorDed = 0; }
            }

            return {
                name: f.name,
                fundType: f.type,
                beginning,
                additions,
                deductions,
                ending,
                priorBeginning: priorBeg,
                priorAdditions: priorAdd,
                priorDeductions: priorDed,
                priorEnding: Math.round((priorBeg + priorAdd - priorDed) * 100) / 100,
            };
        });

        // Totals
        const totalStatutoryFundsBeg = funds.reduce((s, f) => s + f.beginning, 0);
        const totalStatutoryFundsEnd = funds.reduce((s, f) => s + f.ending, 0);
        const totalStatutoryFundsPriorBeg = funds.reduce((s, f) => s + f.priorBeginning, 0);
        const totalStatutoryFundsPriorEnd = funds.reduce((s, f) => s + f.priorEnding, 0);

        // Total equity uses 3060 GL balance directly (no unclosed surplus needed)
        const totalEquityBeg = beginningShareCapital + totalStatutoryFundsBeg + (startBalances.get('3060') ?? 0);
        const totalEquityEnd = endingShareCapital + totalStatutoryFundsEnd + (endBalances.get('3060') ?? 0);
        const totalEquityPriorBeg = priorBeginningShareCapital + totalStatutoryFundsPriorBeg + (prior.retainedSurplus ?? 0);
        const totalEquityPriorEnd = priorEndingShareCapital + totalStatutoryFundsPriorEnd + (prior.retainedSurplus ?? 0);

        return {
            year,
            shareCapital: {
                beginning: beginningShareCapital,
                additions: additionsShareCapital,
                ending: endingShareCapital,
                priorBeginning: priorBeginningShareCapital,
                priorAdditions: priorAdditionsShareCapital,
                priorEnding: priorEndingShareCapital,
            },
            funds,
            totalStatutoryFunds: {
                beginning: totalStatutoryFundsBeg,
                ending: totalStatutoryFundsEnd,
                priorBeginning: totalStatutoryFundsPriorBeg,
                priorEnding: totalStatutoryFundsPriorEnd,
            },
            totalEquity: {
                beginning: totalEquityBeg,
                ending: totalEquityEnd,
                priorBeginning: totalEquityPriorBeg,
                priorEnding: totalEquityPriorEnd,
            },
        };
    }

    // ─── Notes to Financial Statements ───────────────────────────────────────────

    async getNotesToFinancialStatements(year: number): Promise<CdaNotes> {
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
        const balances = await this.getGLBalances(endOfYear);

        const cashOnHand = balances.get('1010') ?? 0;
        const cashInBank = (balances.get('1020') ?? 0) + (balances.get('1030') ?? 0) + (balances.get('1040') ?? 0);

        const outstandingLoans = balances.get('1100') ?? 0;
        const allowance = balances.get('1110') ?? 0;
        const net = outstandingLoans - allowance;

        const reserveFund = balances.get('3020') ?? 0;
        const educationFund = balances.get('3030') ?? 0;
        const communityDevFund = balances.get('3040') ?? 0;
        const optionalFund = balances.get('3050') ?? 0;

        return {
            organizationName: 'POS Cursor Cooperative',
            organizationAddress: 'Purok 2, CCT Village, Linao, Ormoc City',
            registrationNumber: '9520-1080000000036399',
            dateRegistered: 'CDA Certified',
            cashNote: {
                cashOnHand,
                cashInBank,
                total: cashOnHand + cashInBank,
            },
            loanNote: {
                outstandingLoans,
                allowance,
                net,
                pastDue: 0, // In Note 6, past due will be computed dynamically from loan accounts
                current: outstandingLoans,
            },
            statutoryNote: {
                reserveFund,
                educationFund,
                communityDevFund,
                optionalFund,
                total: reserveFund + educationFund + communityDevFund + optionalFund,
            },
        };
    }

    // ─── Surplus Allocation Action ───────────────────────────────────────────────

    async allocateSurplus(
        year: number,
        netSurplus: number,
        allocations: { type: string; percentage: number; amount: number }[],
        performedBy: string = 'System'
    ): Promise<void> {
        // Validation: total allocations should equal netSurplus (allowing tiny roundings)
        const totalAllocated = allocations.reduce((s, a) => s + a.amount, 0);
        if (Math.abs(totalAllocated - netSurplus) > 0.05) {
            throw new Error(`Allocations total (₱${totalAllocated.toFixed(2)}) must equal net surplus (₱${netSurplus.toFixed(2)}).`);
        }

        const journalService = new JournalEntryServiceClass(this.db);
        const lines: { accountCode: string; debitAmount?: number; creditAmount?: number; description: string }[] = [];

        // Debit Retained Surplus (3060)
        lines.push({
            accountCode: '3060',
            debitAmount: netSurplus,
            description: `Distribution of net surplus for FY ${year}`,
        });

        // Credit respective accounts
        for (const alloc of allocations) {
            let targetCode = '';
            if (alloc.type === 'reserve') targetCode = '3020';
            else if (alloc.type === 'education') targetCode = '3030';
            else if (alloc.type === 'union_federation') targetCode = '2070'; // Due to Union/Federation
            else if (alloc.type === 'community_dev') targetCode = '3040';
            else if (alloc.type === 'optional') targetCode = '3050';
            else if (alloc.type === 'interest_on_capital') targetCode = '2050'; // Interest on Share Capital Payable
            else if (alloc.type === 'patronage_refund') targetCode = '2060'; // Patronage Refund Payable

            if (targetCode) {
                lines.push({
                    accountCode: targetCode,
                    creditAmount: alloc.amount,
                    description: `Allocation of ${alloc.percentage}% to ${alloc.type} fund`,
                });
            }
        }

        // Post Journal Entry
        await this.db.write(async () => {
            // Save allocations records
            const preparedAllocations = allocations.map(a =>
                this.db.get<StatutoryFundAllocation>('statutory_fund_allocations').prepareCreate(record => {
                    record.fiscalYear = year;
                    record.fundType = a.type;
                    record.amount = a.amount;
                    record.percentage = a.percentage;
                    record.performedBy = performedBy;
                })
            );

            await this.db.batch(...preparedAllocations);
        });

        // Create Journal Entry
        await journalService.createEntry({
            entryDate: new Date(year, 11, 31, 23, 59, 0), // End of year
            description: `FY ${year} Net Surplus Statutory Allocations`,
            entryType: 'closing',
            lines,
        }, performedBy);
    }
    // ─── Complete Annual Report ──────────────────────────────────────────────────
}

const instance = new CoopFinancialReportServiceClass();
export { instance as CoopFinancialReportService };
export default instance;
