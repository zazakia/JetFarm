/**
 * FinancialStatementService
 *
 * Computes the five official financial statements for the Agri-One
 * annual report.
 *
 * Each method accepts a `year` parameter and returns both current-year and
 * prior-year comparative figures so the annual report can display side-by-side columns.
 *
 * Statements:
 *   1. Statement of Financial Condition  (Balance Sheet)
 *   2. Statement of Activities           (Income / Surplus or Deficit)
 *   3. Statement of Changes in Fund Balance
 *   4. Statement of Cash Flows          (Operating / Investing / Financing)
 *   5. Notes to Financial Statements    (quantitative disclosures)
 */

import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import { CoopFinancialReportService } from './CoopFinancialReportService';
import { COMPANY_NAME_FULL } from '../constants/brand';
import Expense from '../database/models/Expense';
import CashTransaction from '../database/models/CashTransaction';
import AgriFarmExpense from '../database/models/AgriFarmExpense';
import AgriLaborLog from '../database/models/AgriLaborLog';
import AgriWeeklySettlement from '../database/models/AgriWeeklySettlement';
import AgriInvestorLedger from '../database/models/AgriInvestorLedger';
import AgriParcel from '../database/models/AgriParcel';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriInvestor from '../database/models/AgriInvestor';
import { CashService } from './CashService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function yearRange(year: number): { start: number; end: number } {
    return {
        start: new Date(year, 0, 1).getTime(),
        end: new Date(year, 11, 31, 23, 59, 59, 999).getTime(),
    };
}

function beforeYear(year: number): number {
    return new Date(year, 0, 1).getTime();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComparativeAmount {
    current: number;
    prior: number;
}

export interface FinancialConditionData {
    year: number;
    priorYear: number;
    asOf: Date;
    /** ASSETS */
    assets: {
        cashOnHand: ComparativeAmount;
        cashInBank: ComparativeAmount;
        /** Standing crops, harvested produce and farm-input inventory (1240 / 1245 / 1246). */
        farmAssets: ComparativeAmount;
        otherReceivables: ComparativeAmount;
        sundryAssets: ComparativeAmount;
        totalCurrentAssets: ComparativeAmount;
        totalAssets: ComparativeAmount;
    };
    /** LIABILITIES */
    liabilities: {
        /** Land-owner settlement payouts owed for the crop period (2035). */
        settlementsPayable: ComparativeAmount;
        /** Field labour accrued but unpaid (2036). */
        laborPayable: ComparativeAmount;
        /** Supplier / accounts-payable balances (2030, 2040). */
        accountsPayable: ComparativeAmount;
        /** Every other 2xxx balance, including the capital-partner profit share (2050). */
        otherPayables: ComparativeAmount;
        totalLiabilities: ComparativeAmount;
    };
    /** FUND BALANCE / EQUITY */
    fundBalance: {
        shareCapital: ComparativeAmount;
        /** Project & partner equity contributed to the farm operation (3015). */
        projectEquity: ComparativeAmount;
        reserveFund: ComparativeAmount;
        educationFund: ComparativeAmount;
        communityDevFund: ComparativeAmount;
        optionalFund: ComparativeAmount;
        retainedSurplus: ComparativeAmount;
        totalFundBalance: ComparativeAmount;
    };
    totalLiabilitiesAndFundBalance: ComparativeAmount;
}

export interface ActivitiesData {
    year: number;
    priorYear: number;
    revenues: {
        /** Off-take paid for delivered kilos (4140). */
        offtakeRevenue: ComparativeAmount;
        /** By-product and residual sales (4145). */
        byproductRevenue: ComparativeAmount;
        otherIncome: ComparativeAmount;
        totalRevenues: ComparativeAmount;
    };
    expenses: {
        /** The 5160-5169 production block: settlements, labour, inputs, machinery, other. */
        farmProductionCosts: ComparativeAmount;
        salariesAndWages: ComparativeAmount;
        officeExpenses: ComparativeAmount;
        depreciationAndAmortization: ComparativeAmount;
        /** Remaining administrative lines (5030/5040/5060/5070/5080/5090 and the 5xxx residual). */
        otherExpenses: ComparativeAmount;
        totalExpenses: ComparativeAmount;
    };
    netSurplus: ComparativeAmount;
}

export interface ChangesInFundBalanceData {
    year: number;
    priorYear: number;
    opening: ComparativeAmount;
    netSurplusForYear: ComparativeAmount;
    statutoryAllocations: {
        reserveFund: ComparativeAmount;
        educationFund: ComparativeAmount;
        communityDevFund: ComparativeAmount;
        optionalFund: ComparativeAmount;
        totalAllocations: ComparativeAmount;
    };
    /**
     * The surplus the statutory appropriations leave behind. There is no member dividend on this
     * variant — the enterprise is a farm operation, so what is not appropriated stays retained.
     */
    unallocatedSurplus: ComparativeAmount;
    closing: ComparativeAmount;
}

export interface CashFlowsData {
    year: number;
    priorYear: number;
    operating: {
        items: { label: string; current: number; prior: number; inflow: boolean }[];
        netOperating: ComparativeAmount;
    };
    investing: {
        items: { label: string; current: number; prior: number; inflow: boolean }[];
        netInvesting: ComparativeAmount;
    };
    financing: {
        items: { label: string; current: number; prior: number; inflow: boolean }[];
        netFinancing: ComparativeAmount;
    };
    netChange: ComparativeAmount;
    beginningCash: ComparativeAmount;
    endingCash: ComparativeAmount;
}

export interface NotesData {
    year: number;
    /** Note 1: Organization */
    organization: {
        name: string;
        address: string;
        registrationNumber: string;
        dateRegistered: string;
        primaryPurpose: string;
    };
    /** Note 2: Significant Accounting Policies — static boilerplate, included in PDF */
    accountingPolicies: string[];
    /** Note 3: Farm Operations */
    farmOperations: {
        numberOfParcels: number;
        totalHectares: number;
        activeCropCycles: number;
        totalPlantedHectares: number;
        expectedYieldKg: number;
        actualYieldKg: number;
    };
    /** Note 4: Production Costs */
    productionCosts: {
        farmExpenses: number;
        laborPaid: number;
        landOwnerSettlements: number;
        totalProductionCost: number;
    };
    /** Note 5: Investor Participation */
    investorParticipation: {
        numberOfInvestors: number;
        capitalInjected: number;
        offtakeDeductions: number;
        payoutsRefunded: number;
        netInvestorBalance: number;
    };
    /** Note 6: Statutory Funds */
    statutoryFunds: {
        reserveFund: number;
        educationFund: number;
        communityDevFund: number;
        optionalFund: number;
    };
    /** Note 7: Related Party Transactions */
    relatedPartyNote: string;
    /** Note 8: Events After Reporting Period */
    eventsAfterReportingPeriod: string;
}

export interface AnnualReportData {
    year: number;
    priorYear: number;
    generatedAt: Date;
    financialCondition: FinancialConditionData;
    activities: ActivitiesData;
    changesInFundBalance: ChangesInFundBalanceData;
    cashFlows: CashFlowsData;
    notes: NotesData;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class FinancialStatementService {

    /**
     * Fetch all data needed for the annual report for the given year and its prior year.
     */
    static async getAnnualReportData(year: number): Promise<AnnualReportData> {
        const priorYear = year - 1;

        const [
            financialCondition,
            activities,
            cashFlows,
            notes,
        ] = await Promise.all([
            this.getStatementOfFinancialCondition(year),
            this.getStatementOfActivities(year),
            this.getStatementOfCashFlows(year),
            this.getNotes(year),
        ]);

        const changesInFundBalance = this.buildChangesInFundBalance(
            year,
            financialCondition,
            activities,
        );

        return {
            year,
            priorYear,
            generatedAt: new Date(),
            financialCondition,
            activities,
            changesInFundBalance,
            cashFlows,
            notes,
        };
    }

    // ─── Statement of Financial Condition ────────────────────────────────────

    static async getStatementOfFinancialCondition(year: number): Promise<FinancialConditionData> {
        const priorYear = year - 1;
        const gl = await CoopFinancialReportService.getStatementOfFinancialCondition(year);

        // The ledger service reports a variance on every line; this statement's consumers compute
        // their own, and ComparativeAmount deliberately has no variance field.
        const strip = (a?: { current: number; prior: number } | null): ComparativeAmount => ({
            current: a?.current ?? 0,
            prior: a?.prior ?? 0,
        });

        return {
            year,
            priorYear,
            asOf: new Date(year, 11, 31),
            assets: {
                cashOnHand: strip(gl.assets.cashOnHand),
                cashInBank: strip(gl.assets.cashInBank),
                farmAssets: strip(gl.assets.farmAssets),
                otherReceivables: strip(gl.assets.otherReceivables),
                sundryAssets: strip(gl.assets.sundryAssets),
                totalCurrentAssets: strip(gl.assets.totalCurrentAssets),
                totalAssets: strip(gl.assets.totalAssets),
            },
            liabilities: {
                settlementsPayable: strip(gl.liabilities.settlementsPayable),
                laborPayable: strip(gl.liabilities.laborPayable),
                accountsPayable: strip(gl.liabilities.accountsPayable),
                otherPayables: strip(gl.liabilities.otherPayables),
                totalLiabilities: strip(gl.liabilities.totalLiabilities),
            },
            fundBalance: {
                shareCapital: strip(gl.equity.paidUpCapital),
                projectEquity: strip(gl.equity.projectEquity),
                reserveFund: strip(gl.equity.reserveFund),
                educationFund: strip(gl.equity.educationFund),
                communityDevFund: strip(gl.equity.communityDevFund),
                optionalFund: strip(gl.equity.optionalFund),
                retainedSurplus: strip(gl.equity.retainedSurplus),
                totalFundBalance: strip(gl.equity.totalEquity),
            },
            totalLiabilitiesAndFundBalance: strip(gl.totalLiabilitiesAndEquity)
        };
    }

    private static async _computeFinancialConditionForYear(year: number) { return {} as any; }

    // ─── Statement of Activities ──────────────────────────────────────────────

    static async getStatementOfActivities(year: number): Promise<ActivitiesData> {
        const priorYear = year - 1;
        const gl = await CoopFinancialReportService.getStatementOfOperations(year);

        const addCmp = (...args: {current: number, prior: number}[]) => ({
            current: args.reduce((s, a) => s + (a?.current || 0), 0),
            prior: args.reduce((s, a) => s + (a?.prior || 0), 0)
        });
        const strip = (a?: { current: number; prior: number } | null): ComparativeAmount => ({
            current: a?.current ?? 0,
            prior: a?.prior ?? 0,
        });

        return {
            year,
            priorYear,
            revenues: {
                offtakeRevenue: strip(gl.revenues.offtakeRevenue),
                byproductRevenue: strip(gl.revenues.byproductRevenue),
                otherIncome: strip(gl.revenues.otherRevenue),
                totalRevenues: strip(gl.revenues.totalRevenues),
            },
            expenses: {
                farmProductionCosts: strip(gl.expenses.farmProductionCosts),
                salariesAndWages: strip(gl.expenses.salaries),
                officeExpenses: strip(gl.expenses.office),
                depreciationAndAmortization: strip(gl.expenses.depreciation),
                // Every administrative line the report does not name individually, so the displayed
                // rows still add back to totalExpenses.
                otherExpenses: addCmp(
                    gl.expenses.communication,
                    gl.expenses.transportation,
                    gl.expenses.taxes,
                    gl.expenses.repairs,
                    gl.expenses.training,
                    gl.expenses.professional,
                    gl.expenses.otherExpenses,
                ),
                totalExpenses: strip(gl.expenses.totalExpenses),
            },
            netSurplus: strip(gl.netSurplus),
        };
    }

    private static async _computeActivitiesForYear(year: number) { return {} as any; }

    // ─── Statement of Changes in Fund Balance ────────────────────────────────

    static buildChangesInFundBalance(
        year: number,
        fc: FinancialConditionData,
        act: ActivitiesData,
    ): ChangesInFundBalanceData {
        const cmp = (c: number, p: number): ComparativeAmount => ({ current: c, prior: p });

        const currReserve = Math.round(act.netSurplus.current * 0.10 * 100) / 100;
        const priorReserve = Math.round(act.netSurplus.prior * 0.10 * 100) / 100;
        const currEdu = currReserve;
        const priorEdu = priorReserve;
        const currComm = Math.round(act.netSurplus.current * 0.03 * 100) / 100;
        const priorComm = Math.round(act.netSurplus.prior * 0.03 * 100) / 100;
        const currOpt = Math.round(act.netSurplus.current * 0.07 * 100) / 100;
        const priorOpt = Math.round(act.netSurplus.prior * 0.07 * 100) / 100;

        const currTotalAlloc = currReserve + currEdu + currComm + currOpt;
        const priorTotalAlloc = priorReserve + priorEdu + priorComm + priorOpt;

        const currOpening = fc.fundBalance.totalFundBalance.current - act.netSurplus.current + currTotalAlloc;
        const priorOpening = fc.fundBalance.totalFundBalance.prior - act.netSurplus.prior + priorTotalAlloc;

        return {
            year,
            priorYear: year - 1,
            opening: cmp(currOpening, priorOpening),
            netSurplusForYear: act.netSurplus,
            statutoryAllocations: {
                reserveFund: cmp(currReserve, priorReserve),
                educationFund: cmp(currEdu, priorEdu),
                communityDevFund: cmp(currComm, priorComm),
                optionalFund: cmp(currOpt, priorOpt),
                totalAllocations: cmp(currTotalAlloc, priorTotalAlloc),
            },
            // closing = opening + surplus - allocations, so whatever the appropriations do not
            // claim is disclosed as retained rather than assumed by the reader.
            unallocatedSurplus: cmp(act.netSurplus.current - currTotalAlloc,
                                    act.netSurplus.prior - priorTotalAlloc),
            closing: fc.fundBalance.totalFundBalance,
        };
    }

    // ─── Statement of Cash Flows ──────────────────────────────────────────────

    static async getStatementOfCashFlows(year: number): Promise<CashFlowsData> {
        const priorYear = year - 1;
        const [curr, prior] = await Promise.all([
            this._computeCashFlowsForYear(year),
            this._computeCashFlowsForYear(priorYear),
        ]);

        const cmp = (c: number, p: number): ComparativeAmount => ({ current: c, prior: p });

        return {
            year,
            priorYear,
            operating: {
                items: [
                    { label: 'Cash Receipts Recorded', current: curr.cashReceipts, prior: prior.cashReceipts, inflow: true },
                    { label: 'Operating Expenses Paid', current: curr.operatingExpenses, prior: prior.operatingExpenses, inflow: false },
                ],
                netOperating: cmp(curr.netOperating, prior.netOperating),
            },
            investing: {
                items: [
                    { label: 'Farm Inputs Paid', current: curr.farmInputs, prior: prior.farmInputs, inflow: false },
                    { label: 'Labour & Land-Owner Payouts', current: curr.laborAndSettlements, prior: prior.laborAndSettlements, inflow: false },
                ],
                netInvesting: cmp(curr.netInvesting, prior.netInvesting),
            },
            financing: {
                items: [
                    { label: 'Investor Capital Injected', current: curr.investorCapital, prior: prior.investorCapital, inflow: true },
                    { label: 'Offtake Deductions & Refunds', current: curr.investorOutflows, prior: prior.investorOutflows, inflow: false },
                ],
                netFinancing: cmp(curr.netFinancing, prior.netFinancing),
            },
            netChange: cmp(curr.netChange, prior.netChange),
            beginningCash: cmp(curr.beginningCash, prior.beginningCash),
            endingCash: cmp(curr.endingCash, prior.endingCash),
        };
    }

    private static async _computeCashFlowsForYear(year: number) {
        const { start, end } = yearRange(year);
        const NOT_DELETED = Q.where('deleted_at', null);

        const [cashIns, expenses, farmExpenses, laborPaid, settlementsPaid, investorLedgers] = await Promise.all([
            database.get<CashTransaction>('cash_transactions').query(
                NOT_DELETED,
                Q.where('type', 'in'),
                Q.where('transaction_date', Q.between(start, end)),
            ).fetch(),
            database.get<Expense>('expenses').query(
                NOT_DELETED,
                Q.where('expense_date', Q.between(start, end)),
            ).fetch(),
            database.get<AgriFarmExpense>('agri_farm_expenses').query(
                NOT_DELETED,
                Q.where('expense_date', Q.between(start, end)),
            ).fetch(),
            database.get<AgriLaborLog>('agri_labor_logs').query(
                NOT_DELETED,
                Q.where('payment_status', 'paid'),
                Q.where('work_date', Q.between(start, end)),
            ).fetch(),
            database.get<AgriWeeklySettlement>('agri_weekly_settlements').query(
                NOT_DELETED,
                Q.where('payment_status', 'paid'),
                Q.where('week_end_date', Q.between(start, end)),
            ).fetch(),
            database.get<AgriInvestorLedger>('agri_investor_ledgers').query(
                NOT_DELETED,
                Q.where('transaction_date', Q.between(start, end)),
            ).fetch(),
        ]);

        const sum = <T,>(rows: T[], pick: (row: T) => number) =>
            rows.reduce((total, row) => total + (pick(row) ?? 0), 0);

        const cashReceipts = sum(cashIns, t => t.amount);
        const operatingExpenses = sum(expenses, e => e.amount);
        const netOperating = cashReceipts - operatingExpenses;

        const farmInputs = sum(farmExpenses, fe => fe.amount);
        const laborAndSettlements =
            sum(laborPaid, ll => ll.totalPay) + sum(settlementsPaid, ws => ws.netPayoutDueThisWeek);
        const netInvesting = -(farmInputs + laborAndSettlements);

        const investorCapital = sum(
            investorLedgers.filter(l => l.type === 'capital_injection' || l.type === 'equipment_provision'),
            l => l.amount,
        );
        const investorOutflows = sum(
            investorLedgers.filter(l => l.type === 'harvest_offtake' || l.type === 'payout_refund'),
            l => l.amount,
        );
        const netFinancing = investorCapital - investorOutflows;

        const netChange = netOperating + netInvesting + netFinancing;

        // Opening cash is only known from the first recorded starting balance onward.
        const beginningCash = 0;
        const endingCash = beginningCash + netChange;

        return {
            cashReceipts,
            operatingExpenses,
            netOperating,
            farmInputs,
            laborAndSettlements,
            netInvesting,
            investorCapital,
            investorOutflows,
            netFinancing,
            netChange,
            beginningCash,
            endingCash,
        };
    }

    // ─── Notes to Financial Statements ───────────────────────────────────────

    static async getNotes(year: number): Promise<NotesData> {
        const { start, end } = yearRange(year);
        const NOT_DELETED = Q.where('deleted_at', null);

        const [parcels, cropCycles, farmExpenses, laborPaid, settlementsPaid, investorLedgers, investors] = await Promise.all([
            database.get<AgriParcel>('agri_parcels').query(NOT_DELETED).fetch(),
            database.get<AgriCropCycle>('agri_crop_cycles')
                .query(NOT_DELETED, Q.where('planting_date', Q.between(start, end))).fetch(),
            database.get<AgriFarmExpense>('agri_farm_expenses')
                .query(NOT_DELETED, Q.where('expense_date', Q.between(start, end))).fetch(),
            database.get<AgriLaborLog>('agri_labor_logs')
                .query(NOT_DELETED, Q.where('payment_status', 'paid')).fetch(),
            database.get<AgriWeeklySettlement>('agri_weekly_settlements')
                .query(NOT_DELETED, Q.where('payment_status', 'paid')).fetch(),
            database.get<AgriInvestorLedger>('agri_investor_ledgers').query(NOT_DELETED).fetch(),
            database.get<AgriInvestor>('agri_investors').query(NOT_DELETED).fetch(),
        ]);

        const sum = <T,>(rows: T[], pick: (row: T) => number) =>
            rows.reduce((total, row) => total + (pick(row) ?? 0), 0);

        const activeCycles = cropCycles.filter(c => !['completed', 'closed'].includes((c.status || '').toLowerCase()));
        const farmExpensesTotal = sum(farmExpenses, fe => fe.amount);
        const laborPaidTotal = sum(laborPaid, ll => ll.totalPay);
        const settlementsTotal = sum(settlementsPaid, ws => ws.netPayoutDueThisWeek);

        const capitalInjected = sum(
            investorLedgers.filter(l => l.type === 'capital_injection' || l.type === 'equipment_provision'),
            l => l.amount,
        );
        const offtakeDeductions = sum(investorLedgers.filter(l => l.type === 'harvest_offtake'), l => l.amount);
        const payoutsRefunded = sum(investorLedgers.filter(l => l.type === 'payout_refund'), l => l.amount);

        // Statutory reserves are still estimated from cumulative operating results:
        // recorded cash receipts less all recorded expenses and production costs.
        const cashIns = await database.get<CashTransaction>('cash_transactions')
            .query(NOT_DELETED, Q.where('type', 'in')).fetch();
        const allExpenses = await database.get<Expense>('expenses').query(NOT_DELETED).fetch();
        const rawHistoricalSurplus = sum(cashIns, t => t.amount)
            - sum(allExpenses, e => e.amount)
            - farmExpensesTotal - laborPaidTotal - settlementsTotal;
        // A crop year that runs at a loss carries no distribable surplus, so the
        // base for the statutory percentages is floored at zero. Negative funds
        // would otherwise be disclosed as reserves the enterprise does not hold.
        const historicalSurplus = Math.max(0, rawHistoricalSurplus);

        return {
            year,
            organization: {
                name: COMPANY_NAME_FULL,
                address: 'P-2, Barangay Linao, Ormoc City, Leyte',
                registrationNumber: '[Registration Number]',
                dateRegistered: '[Date of Registration]',
                primaryPurpose: 'To develop agricultural land into crop production cycles shared with land owners and investors, and to settle the harvest on a per-kilo basis.',
            },
            accountingPolicies: [
                'Basis of Preparation — The financial statements have been prepared in accordance with Philippine Financial Reporting Standards (PFRS) for Small and Medium-sized Entities (SMEs).',
                'Revenue Recognition — Harvest revenue is recognized when the delivered kilos are weighed in and the off-take price per kilo is agreed.',
                'Biological Assets & Farm Inputs — Fertilizer, chemicals, seeds and other inputs are expensed in the crop cycle in which they are applied.',
                'Labour & Land-Owner Settlements — Field labour is expensed when the work is performed; land-owner settlements are recognized at the computed payout for the week.',
                'Investor Participation — Investor capital injections are carried as a liability to the investor and reduced by harvest off-take deductions and refunds.',
                'Statutory Reserves — A minimum of 10% of net surplus is appropriated to the General Reserve Fund and 10% to the Education and Training Fund before distribution.',
                'Cash and Cash Equivalents — Cash and cash equivalents include cash on hand and deposits with banks with original maturities of three months or less.',
            ],
            farmOperations: {
                numberOfParcels: parcels.length,
                totalHectares: sum(parcels, pr => pr.areaHectares),
                activeCropCycles: activeCycles.length,
                totalPlantedHectares: sum(cropCycles, c => c.areaPlantedHa),
                expectedYieldKg: sum(cropCycles, c => c.expectedYieldKg),
                actualYieldKg: sum(cropCycles, c => c.totalActualYieldKg),
            },
            productionCosts: {
                farmExpenses: farmExpensesTotal,
                laborPaid: laborPaidTotal,
                landOwnerSettlements: settlementsTotal,
                totalProductionCost: farmExpensesTotal + laborPaidTotal + settlementsTotal,
            },
            investorParticipation: {
                numberOfInvestors: investors.length,
                capitalInjected,
                offtakeDeductions,
                payoutsRefunded,
                netInvestorBalance: capitalInjected - offtakeDeductions - payoutsRefunded,
            },
            statutoryFunds: {
                reserveFund: Math.round(historicalSurplus * 0.10 * 100) / 100,
                educationFund: Math.round(historicalSurplus * 0.10 * 100) / 100,
                communityDevFund: Math.round(historicalSurplus * 0.03 * 100) / 100,
                optionalFund: Math.round(historicalSurplus * 0.07 * 100) / 100,
            },
            relatedPartyNote: 'Transactions with land owners, field workers and crop investors are recorded at the rates agreed in the parcel lease and investor contracts, and are disclosed here in aggregate.',
            eventsAfterReportingPeriod: 'No material events occurred after the reporting period that would require adjustment to or disclosure in these financial statements.',
        };
    }
}
