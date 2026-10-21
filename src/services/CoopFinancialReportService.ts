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
import { COMPANY_NAME_FULL } from '../constants/brand';


/**
 * Agribusiness financial statements, built from the general ledger.
 *
 * History this file carries: it was written as a CDA cooperative template whose lines enumerated the
 * lending accounts (1100/1200/1110 loans receivable and allowance, 2010 savings deposits, 2050/2060
 * interest-on-share-capital and patronage payables, 4010/4020/4030 interest, service charges and
 * membership fees). On the agribusiness-only variant those accounts post nothing, while every
 * agribusiness event writes to 1240/1245/1246 (standing crops, harvested produce, farm inputs),
 * 2035/2036 (land-owner settlement and field-labour payables), 3015 (project equity), 4140/4145
 * (offtake and by-product revenue) and 5160-5169 (farm production costs). Enumerating only the old
 * codes made the real numbers invisible AND made the totals wrong, because the totals were the sum of
 * the enumerated lines.
 *
 * The rule that keeps that from coming back: each section total is the sum of the whole account class
 * (every 1xxx / 2xxx / 3xxx / 4xxx / 5xxx balance), and the named lines below are a presentation of
 * that class. An account that is not named therefore still lands in the total, so a statement can be
 * complete before it is pretty. The class sum is what the tests assert.
 */

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
        farmAssets: CdaComparativeAmount;
        otherReceivables: CdaComparativeAmount;
        totalCurrentAssets: CdaComparativeAmount;
        sundryAssets: CdaComparativeAmount;
        totalNonCurrentAssets: CdaComparativeAmount;
        totalAssets: CdaComparativeAmount;
    };
    liabilities: {
        settlementsPayable: CdaComparativeAmount;
        laborPayable: CdaComparativeAmount;
        accountsPayable: CdaComparativeAmount;
        otherPayables: CdaComparativeAmount;
        totalCurrentLiabilities: CdaComparativeAmount;
        totalLiabilities: CdaComparativeAmount;
    };
    equity: {
        authorizedCapital: number; // Config values for current year
        priorAuthorizedCapital: number; // Config values for prior year
        subscribedCapital: CdaComparativeAmount;
        subscriptionReceivable: CdaComparativeAmount;
        paidUpCapital: CdaComparativeAmount;
        projectEquity: CdaComparativeAmount;
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
        offtakeRevenue: CdaComparativeAmount;
        byproductRevenue: CdaComparativeAmount;
        otherRevenue: CdaComparativeAmount;
        totalRevenues: CdaComparativeAmount;
    };
    expenses: {
        farmProductionCosts: CdaComparativeAmount;
        landOwnerSettlements: CdaComparativeAmount;
        farmLabor: CdaComparativeAmount;
        farmInputs: CdaComparativeAmount;
        machineryAndLogistics: CdaComparativeAmount;
        otherFarmCosts: CdaComparativeAmount;
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
    projectEquity: {
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
    farmAssetNote: {
        standingCrops: number;
        harvestedProduce: number;
        farmInputsInventory: number;
        total: number;
    };
    settlementNote: {
        landOwnerSettlementsPayable: number;
        farmLaborPayable: number;
        total: number;
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
    farmAssets?: number;
    otherReceivables?: number;
    sundryAssets?: number;
    totalAssets?: number;
    settlementsPayable?: number;
    laborPayable?: number;
    accountsPayable?: number;
    otherPayables?: number;
    totalCurrentLiabilities?: number;
    subscribedCapital?: number;
    subscriptionReceivable?: number;
    projectEquity?: number;
    reserveFund?: number;
    educationFund?: number;
    communityDevFund?: number;
    optionalFund?: number;
    retainedSurplus?: number;
    totalEquity?: number;
    authorizedShareCapital?: number;

    offtakeRevenue?: number;
    byProductRevenue?: number;
    otherRevenue?: number;
    farmProductionCosts?: number;
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

// ─── Account-class buckets ─────────────────────────────────────────────────────
// Named presentation lines. Anything in a class that is not named here still reaches the class
// total (see sumClass), which is the property the statements depend on.
const CASH_ON_HAND_CODES = ['1010', '1011'];
const CASH_IN_BANK_CODES = ['1020', '1030', '1040'];
/**
 * 1210 (Merchandise Inventory - Agri-Store) is deliberately NOT here: the agri-store business module
 * was retired with src/modules/, so no posting path reaches it on this branch. A legacy balance still
 * lands in totalAssets through the 1xxx class sum rather than silently disappearing from the sheet.
 */
const FARM_ASSET_CODES = ['1240', '1245', '1246'];
const RECEIVABLE_CODES = ['1300', '1400', '1500'];
const NON_CURRENT_ASSET_CODES = ['1600', '1700', '1710'];
/** Contra-asset accounts keep their own sign, so they are subtracted rather than summed in. */
const CONTRA_ASSET_CODES = ['1110'];

const SETTLEMENT_PAYABLE_CODES = ['2035'];
const LABOR_PAYABLE_CODES = ['2036'];
const ACCOUNTS_PAYABLE_CODES = ['2030', '2040'];

const OFFTAKE_REVENUE_CODES = ['4140'];
const BYPRODUCT_REVENUE_CODES = ['4145'];

const LAND_OWNER_SETTLEMENT_CODES = ['5160'];
const FARM_LABOR_CODES = ['5161'];
const FARM_INPUT_CODES = ['5162', '5163', '5165'];
const MACHINERY_LOGISTICS_CODES = ['5164', '5167', '5168'];
const OTHER_FARM_COST_CODES = ['5169'];
const FARM_PRODUCTION_CODES = [
    ...LAND_OWNER_SETTLEMENT_CODES,
    ...FARM_LABOR_CODES,
    ...FARM_INPUT_CODES,
    ...MACHINERY_LOGISTICS_CODES,
    ...OTHER_FARM_COST_CODES,
];

const round2 = (value: number): number => Math.round(value * 100) / 100;


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

    /** Sum the named accounts of a class. */
    private sumCodes(balances: Map<string, number>, codes: string[]): number {
        return codes.reduce((total, code) => total + (balances.get(code) ?? 0), 0);
    }

    /**
     * Sum every account of a class so an account the presentation does not name cannot go missing
     * from the total. `excludes` names the codes that belong to another presented line (they are
     * already covered by the class sum), and `contra` codes are subtracted because their normal
     * balance opposes the class (1110 allowance against 1xxx assets).
     */
    private sumClass(
        balances: Map<string, number>,
        prefix: string,
        opts: { excludes?: string[]; contra?: string[] } = {}
    ): number {
        const excluded = new Set(opts.excludes ?? []);
        const contra = new Set(opts.contra ?? []);
        let total = 0;
        for (const [code, balance] of balances.entries()) {
            if (!code.startsWith(prefix)) continue;
            if (excluded.has(code)) continue;
            if (contra.has(code)) {
                total -= balance;
                continue;
            }
            total += balance;
        }
        return total;
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
                        r.subscriptionReceivable = settings.subscriptionReceivable;
                        r.subscribedCapital = settings.subscribedCapital;
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

        const authorizedCapital = periodSettings?.authorizedShareCapital ?? 0;
        const subscribedCapital = periodSettings?.subscribedCapital ?? 0;
        const subscriptionReceivable = periodSettings?.subscriptionReceivable ?? 0;

        // Parse prior year comparative data
        const prior: PriorYearData = periodSettings?.priorYearData
            ? JSON.parse(periodSettings.priorYearData)
            : {};

        // Helper to format comparative amount
        const makeComp = (currVal: number, priorVal: number): CdaComparativeAmount => {
            const current = round2(currVal);
            const pVal = round2(priorVal ?? 0);
            return {
                current,
                prior: pVal,
                variance: round2(current - pVal),
            };
        };

        // Assets. The named lines present the farm story; totalAssets is the whole 1xxx class so a
        // code nobody named (a legacy balance, a future account) is still counted.
        const cashOnHand = this.sumCodes(balances, CASH_ON_HAND_CODES);
        const cashInBank = this.sumCodes(balances, CASH_IN_BANK_CODES);
        const farmAssets = this.sumCodes(balances, FARM_ASSET_CODES);
        const otherReceivables = this.sumCodes(balances, RECEIVABLE_CODES);
        const sundryGL = this.sumCodes(balances, NON_CURRENT_ASSET_CODES);
        const sundryAssets = sundryGL || (periodSettings?.sundryAssets ?? 0);

        const totalCurrentAssetsVal = cashOnHand + cashInBank + farmAssets + otherReceivables;
        const totalNonCurrentAssetsVal = this.sumClass(balances, '1', {
            excludes: [...CASH_ON_HAND_CODES, ...CASH_IN_BANK_CODES, ...FARM_ASSET_CODES, ...RECEIVABLE_CODES],
            contra: CONTRA_ASSET_CODES,
        }) || sundryAssets;
        const totalAssetsVal = this.sumClass(balances, '1', { contra: CONTRA_ASSET_CODES });

        // Liabilities
        const settlementsPayable = this.sumCodes(balances, SETTLEMENT_PAYABLE_CODES);
        const laborPayable = this.sumCodes(balances, LABOR_PAYABLE_CODES);
        const accountsPayable = this.sumCodes(balances, ACCOUNTS_PAYABLE_CODES);
        const otherPayables = this.sumClass(balances, '2', {
            excludes: [...SETTLEMENT_PAYABLE_CODES, ...LABOR_PAYABLE_CODES, ...ACCOUNTS_PAYABLE_CODES],
        });

        const totalCurrentLiabilitiesVal = settlementsPayable + laborPayable + accountsPayable + otherPayables;

        // Equity
        const shareCapitalGL = balances.get('3010') ?? 0;
        const paidUpCapitalVal = shareCapitalGL || (subscribedCapital - subscriptionReceivable);
        const projectEquity = balances.get('3015') ?? 0;

        const reserveFund = balances.get('3020') ?? 0;
        const educationFund = balances.get('3030') ?? 0;
        const communityDevFund = balances.get('3040') ?? 0;
        const optionalFund = balances.get('3050') ?? 0;
        const totalStatutoryFundsVal = reserveFund + educationFund + communityDevFund + optionalFund;

        // Retained Surplus: combine the 3060 GL balance with unclosed net surplus.
        // Closing entries debit 3060 when there is a surplus (and credit when there is a loss), so
        // balances.get('3060') = -(net income). Adding unclosedNetSurplus (= 4xxx - 5xxx activity)
        // cancels this out, yielding 0 when all surplus was distributed.
        const unclosedNetSurplus = this.classNetSurplus(balances);
        const unclassifiedEquity = this.sumClass(balances, '3', {
            excludes: ['3010', '3015', '3020', '3030', '3040', '3050', '3060'],
        });
        const retainedSurplus = (balances.get('3060') ?? 0) + unclosedNetSurplus + unclassifiedEquity;
        const totalEquityVal = this.sumClass(balances, '3') + unclosedNetSurplus;

        const priorTotalAssets = prior.totalAssets ?? (
            (prior.cashOnHand ?? 0) + (prior.cashInBank ?? 0) + (prior.farmAssets ?? 0)
            + (prior.otherReceivables ?? 0) + (prior.sundryAssets ?? 0)
        );
        const priorPaidUpCapital = prior.subscribedCapital
            ? (prior.subscribedCapital - (prior.subscriptionReceivable ?? 0))
            : 0;
        const priorTotalEquity = prior.totalEquity ?? (
            priorPaidUpCapital + (prior.projectEquity ?? 0)
            + (prior.reserveFund ?? 0) + (prior.educationFund ?? 0)
            + (prior.communityDevFund ?? 0) + (prior.optionalFund ?? 0)
            + (prior.retainedSurplus ?? 0)
        );
        const priorTotalLiabilities = prior.totalCurrentLiabilities ?? (
            (prior.settlementsPayable ?? 0) + (prior.laborPayable ?? 0)
            + (prior.accountsPayable ?? 0) + (prior.otherPayables ?? 0)
        );

        return {
            year,
            priorYear: year - 1,
            asOf: endOfYear,
            assets: {
                cashOnHand: makeComp(cashOnHand, prior.cashOnHand ?? 0),
                cashInBank: makeComp(cashInBank, prior.cashInBank ?? 0),
                farmAssets: makeComp(farmAssets, prior.farmAssets ?? 0),
                otherReceivables: makeComp(otherReceivables, prior.otherReceivables ?? 0),
                totalCurrentAssets: makeComp(totalCurrentAssetsVal,
                    (prior.cashOnHand ?? 0) + (prior.cashInBank ?? 0) + (prior.farmAssets ?? 0) + (prior.otherReceivables ?? 0)),
                sundryAssets: makeComp(sundryAssets, prior.sundryAssets ?? 0),
                totalNonCurrentAssets: makeComp(totalNonCurrentAssetsVal, prior.sundryAssets ?? 0),
                totalAssets: makeComp(totalAssetsVal, priorTotalAssets),
            },
            liabilities: {
                settlementsPayable: makeComp(settlementsPayable, prior.settlementsPayable ?? 0),
                laborPayable: makeComp(laborPayable, prior.laborPayable ?? 0),
                accountsPayable: makeComp(accountsPayable, prior.accountsPayable ?? 0),
                otherPayables: makeComp(otherPayables, prior.otherPayables ?? 0),
                totalCurrentLiabilities: makeComp(totalCurrentLiabilitiesVal, priorTotalLiabilities),
                totalLiabilities: makeComp(totalCurrentLiabilitiesVal, priorTotalLiabilities),
            },
            equity: {
                authorizedCapital,
                priorAuthorizedCapital: prior.authorizedShareCapital ?? 0,
                subscribedCapital: makeComp(subscribedCapital, prior.subscribedCapital ?? 0),
                subscriptionReceivable: makeComp(subscriptionReceivable, prior.subscriptionReceivable ?? 0),
                paidUpCapital: makeComp(paidUpCapitalVal, priorPaidUpCapital),
                projectEquity: makeComp(projectEquity, prior.projectEquity ?? 0),
                reserveFund: makeComp(reserveFund, prior.reserveFund ?? 0),
                educationFund: makeComp(educationFund, prior.educationFund ?? 0),
                communityDevFund: makeComp(communityDevFund, prior.communityDevFund ?? 0),
                optionalFund: makeComp(optionalFund, prior.optionalFund ?? 0),
                totalStatutoryFunds: makeComp(totalStatutoryFundsVal,
                    (prior.reserveFund ?? 0) + (prior.educationFund ?? 0) + (prior.communityDevFund ?? 0) + (prior.optionalFund ?? 0)),
                retainedSurplus: makeComp(retainedSurplus, prior.retainedSurplus ?? 0),
                totalEquity: makeComp(totalEquityVal, priorTotalEquity),
            },
            totalLiabilitiesAndEquity: makeComp(
                totalCurrentLiabilitiesVal + totalEquityVal,
                priorTotalLiabilities + priorTotalEquity
            ),
        };
    }

    /**
     * Net surplus implied by the open income and expense classes: 4xxx credits less 5xxx debits.
     * Derived from the class, not from an enumerated list, so income or cost the presentation does
     * not name still closes into equity.
     */
    private classNetSurplus(balances: Map<string, number>): number {
        let revenue = 0;
        let expense = 0;
        for (const [code, balance] of balances.entries()) {
            if (code.startsWith('4')) revenue += balance;
            if (code.startsWith('5')) expense += balance;
        }
        return revenue - expense;
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
            const current = round2(currVal);
            const pVal = round2(priorVal ?? 0);
            return {
                current,
                prior: pVal,
                variance: round2(current - pVal),
            };
        };

        const getActivity = (selector: (balances: Map<string, number>) => number): number =>
            selector(endBalances) - selector(startBalances);

        const sumOn = (codes: string[]) => (balances: Map<string, number>) => this.sumCodes(balances, codes);
        /**
         * Selects the whole account class (a single leading digit), optionally minus the codes that
         * another presented line already owns. Pass a digit, never a code list -- sumClass matches on
         * a prefix, and a code list belongs in sumOn.
         */
        const classOn = (prefix: string, opts: { excludes?: string[]; contra?: string[] } = {}) =>
            (balances: Map<string, number>) => this.sumClass(balances, prefix, opts);

        // Revenues: the two harvest streams the business actually has, plus everything else in 4xxx.
        const offtakeRevenue = getActivity(sumOn(OFFTAKE_REVENUE_CODES));
        const byproductRevenue = getActivity(sumOn(BYPRODUCT_REVENUE_CODES));
        const otherRevenue = getActivity(classOn('4', {
            excludes: [...OFFTAKE_REVENUE_CODES, ...BYPRODUCT_REVENUE_CODES],
        }));
        const totalRevenuesVal = offtakeRevenue + byproductRevenue + otherRevenue;

        // Expenses: farm production first, then the overhead lines.
        const landOwnerSettlements = getActivity(sumOn(LAND_OWNER_SETTLEMENT_CODES));
        const farmLabor = getActivity(sumOn(FARM_LABOR_CODES));
        const farmInputs = getActivity(sumOn(FARM_INPUT_CODES));
        const machineryAndLogistics = getActivity(sumOn(MACHINERY_LOGISTICS_CODES));
        const otherFarmCosts = getActivity(sumOn(OTHER_FARM_COST_CODES));
        const farmProductionCosts = landOwnerSettlements + farmLabor + farmInputs + machineryAndLogistics + otherFarmCosts;

        const salaries = getActivity(sumOn(['5010']));
        const office = getActivity(sumOn(['5020']));
        const communication = getActivity(sumOn(['5030']));
        const transportation = getActivity(sumOn(['5040']));
        const depreciation = getActivity(sumOn(['5050']));
        const taxes = getActivity(sumOn(['5060']));
        const repairs = getActivity(sumOn(['5070']));
        const training = getActivity(sumOn(['5080']));
        const professional = getActivity(sumOn(['5090']));
        const otherExpenses = getActivity(classOn('5', {
            excludes: [...FARM_PRODUCTION_CODES, '5010', '5020', '5030', '5040', '5050', '5060', '5070', '5080', '5090'],
        }));

        const totalAdminCostsVal = salaries + office + communication + transportation
            + depreciation + taxes + repairs + training + professional + otherExpenses;
        const totalExpensesVal = farmProductionCosts + totalAdminCostsVal;

        const netSurplusVal = totalRevenuesVal - totalExpensesVal;

        // Statutory Allocations details
        const allocations = await this.db.collections
            .get<StatutoryFundAllocation>('statutory_fund_allocations')
            .query(Q.where('fiscal_year', year), Q.where('deleted_at', Q.eq(null)))
            .fetch();

        const allocationRows = [
            { type: 'reserve', label: 'Reserve Fund', defaultPct: 10, priorKey: 'reserveFund' as const },
            { type: 'education', label: 'Education and Training Fund', defaultPct: 10, priorKey: 'educationFund' as const },
            { type: 'community_dev', label: 'Community Development Fund', defaultPct: 3, priorKey: 'communityDevFund' as const },
            { type: 'optional', label: 'Optional Fund', defaultPct: 7, priorKey: 'optionalFund' as const },
            // Cooperative member-benefit allocations are retired with the lending domain; a surplus
            // that is not statutorily reserved stays in retained surplus and is shared out through
            // the investor ledger (agri_investor_ledgers), not through these rows. Nothing is
            // emitted for the remainder either — the statements compute and show the retained
            // balance themselves, so a zero-percentage row here would only double-count it.
        ].map(item => {
            const found = allocations.find(a => a.fundType === item.type);
            const percentage = found ? found.percentage : item.defaultPct;
            const amount = found ? found.amount : round2(netSurplusVal * (percentage / 100));

            return {
                fundType: item.label,
                percentage,
                amount,
                priorAmount: prior[item.priorKey] ?? 0,
            };
        });

        const priorTotalRevenue = (prior.offtakeRevenue ?? 0) + (prior.byProductRevenue ?? 0) + (prior.otherRevenue ?? 0);
        const priorTotalExpenses = (prior.farmProductionCosts ?? 0) + (prior.salaries ?? 0) + (prior.office ?? 0)
            + (prior.communication ?? 0) + (prior.transportation ?? 0) + (prior.depreciation ?? 0)
            + (prior.taxes ?? 0) + (prior.repairs ?? 0) + (prior.training ?? 0) + (prior.professional ?? 0)
            + (prior.otherExpenses ?? 0);

        return {
            year,
            priorYear: year - 1,
            revenues: {
                offtakeRevenue: makeComp(offtakeRevenue, prior.offtakeRevenue ?? 0),
                byproductRevenue: makeComp(byproductRevenue, prior.byProductRevenue ?? 0),
                otherRevenue: makeComp(otherRevenue, prior.otherRevenue ?? 0),
                totalRevenues: makeComp(totalRevenuesVal, priorTotalRevenue),
            },
            expenses: {
                farmProductionCosts: makeComp(farmProductionCosts, prior.farmProductionCosts ?? 0),
                landOwnerSettlements: makeComp(landOwnerSettlements, 0),
                farmLabor: makeComp(farmLabor, 0),
                farmInputs: makeComp(farmInputs, 0),
                machineryAndLogistics: makeComp(machineryAndLogistics, 0),
                otherFarmCosts: makeComp(otherFarmCosts, 0),
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
                totalAdminCosts: makeComp(totalAdminCostsVal, priorTotalExpenses - (prior.farmProductionCosts ?? 0)),
                totalExpenses: makeComp(totalExpensesVal, priorTotalExpenses),
            },
            netSurplus: makeComp(netSurplusVal, priorTotalRevenue - priorTotalExpenses),
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

        const subscribedCapital = periodSettings?.subscribedCapital ?? 0;
        const subscriptionReceivable = periodSettings?.subscriptionReceivable ?? 0;

        // Share Capital Ending Balance: use GL balance directly (not formula + GL)
        const endingShareCapital = endBalances.get('3010') ?? (subscribedCapital - subscriptionReceivable);
        const beginningShareCapital = startBalances.get('3010') ?? (subscribedCapital - subscriptionReceivable);
        const additionsShareCapital = endingShareCapital - beginningShareCapital;

        // Prior Share Capital figures
        const priorEndingShareCapital = prior.subscribedCapital
            ? (prior.subscribedCapital - (prior.subscriptionReceivable ?? 0))
            : 0;
        const priorBeginningShareCapital = prior.authorizedShareCapital ?? 0;
        const priorAdditionsShareCapital = priorEndingShareCapital - priorBeginningShareCapital;

        // Capital contributed by the agribusiness project fund (BioGreen and other partners)
        const endingProjectEquity = endBalances.get('3015') ?? 0;
        const beginningProjectEquity = startBalances.get('3015') ?? 0;

        // Allocate and track individual statutory funds
        const allocations = await this.db.collections
            .get<StatutoryFundAllocation>('statutory_fund_allocations')
            .query(Q.where('fiscal_year', year), Q.where('deleted_at', Q.eq(null)))
            .fetch();

        const getAllocationAmount = (type: string, defaultPct: number): number => {
            const found = allocations.find(a => a.fundType === type);
            if (found) return found.amount;
            // Fallback: estimate from the unclosed net surplus of the income and expense classes
            const netSurplus = this.classNetSurplus(endBalances) - this.classNetSurplus(startBalances);
            return round2(netSurplus * (defaultPct / 100));
        };

        const fundsList = [
            { name: 'RESERVE FUNDS', type: 'reserve', code: '3020', defaultPct: 10 },
            { name: 'EDUCATION AND TRAINING FUND', type: 'education', code: '3030', defaultPct: 10 },
            { name: 'COMMUNITY DEVELOPMENT FUND', type: 'community_dev', code: '3040', defaultPct: 3 },
            { name: 'OPTIONAL FUND', type: 'optional', code: '3050', defaultPct: 7 },
        ];

        const funds = fundsList.map(f => {
            const beginning = startBalances.get(f.code) ?? 0;
            const ending = endBalances.get(f.code) ?? 0;
            const additions = getAllocationAmount(f.type, f.defaultPct);
            const deductions = round2(beginning + additions - ending);

            let priorBeg = 0;
            let priorAdd = 0;
            let priorDed = 0;
            if (prior.subscribedCapital) {
                // If user entered custom comparative figures
                if (f.type === 'reserve') priorBeg = prior.reserveFund ?? 0;
                else if (f.type === 'education') priorBeg = prior.educationFund ?? 0;
                else if (f.type === 'community_dev') priorBeg = prior.communityDevFund ?? 0;
                else if (f.type === 'optional') priorBeg = prior.optionalFund ?? 0;
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
                priorEnding: round2(priorBeg + priorAdd - priorDed),
            };
        });

        // Totals
        const totalStatutoryFundsBeg = funds.reduce((s, f) => s + f.beginning, 0);
        const totalStatutoryFundsEnd = funds.reduce((s, f) => s + f.ending, 0);
        const totalStatutoryFundsPriorBeg = funds.reduce((s, f) => s + f.priorBeginning, 0);
        const totalStatutoryFundsPriorEnd = funds.reduce((s, f) => s + f.priorEnding, 0);

        // Total equity uses the whole 3xxx class plus the unclosed surplus, so an account nobody
        // named in the presentation still shows up in the roll-forward.
        const totalEquityBeg = beginningShareCapital + beginningProjectEquity + totalStatutoryFundsBeg
            + (startBalances.get('3060') ?? 0) + this.classNetSurplus(startBalances);
        const totalEquityEnd = endingShareCapital + endingProjectEquity + totalStatutoryFundsEnd
            + (endBalances.get('3060') ?? 0) + this.classNetSurplus(endBalances);
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
            projectEquity: {
                beginning: beginningProjectEquity,
                additions: endingProjectEquity - beginningProjectEquity,
                ending: endingProjectEquity,
                priorBeginning: 0,
                priorAdditions: 0,
                priorEnding: prior.projectEquity ?? 0,
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

        const cashOnHand = this.sumCodes(balances, CASH_ON_HAND_CODES);
        const cashInBank = this.sumCodes(balances, CASH_IN_BANK_CODES);

        const standingCrops = balances.get('1240') ?? 0;
        const harvestedProduce = balances.get('1245') ?? 0;
        const farmInputsInventory = balances.get('1246') ?? 0;

        const landOwnerSettlementsPayable = balances.get('2035') ?? 0;
        const farmLaborPayable = balances.get('2036') ?? 0;

        const reserveFund = balances.get('3020') ?? 0;
        const educationFund = balances.get('3030') ?? 0;
        const communityDevFund = balances.get('3040') ?? 0;
        const optionalFund = balances.get('3050') ?? 0;

        return {
            organizationName: COMPANY_NAME_FULL,
            organizationAddress: 'Purok 2, CCT Village, Linao, Ormoc City',
            registrationNumber: '9520-1080000000036399',
            dateRegistered: 'SEC / CDA Registered',
            cashNote: {
                cashOnHand,
                cashInBank,
                total: cashOnHand + cashInBank,
            },
            farmAssetNote: {
                standingCrops,
                harvestedProduce,
                farmInputsInventory,
                total: standingCrops + harvestedProduce + farmInputsInventory,
            },
            settlementNote: {
                landOwnerSettlementsPayable,
                farmLaborPayable,
                total: landOwnerSettlementsPayable + farmLaborPayable,
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
            else if (alloc.type === 'interest_on_capital') targetCode = '2050'; // Capital partner profit share
            else if (alloc.type === 'patronage_refund') targetCode = '2060'; // Retained surplus distribution

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
