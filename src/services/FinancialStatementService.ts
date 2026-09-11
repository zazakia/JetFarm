/**
 * FinancialStatementService
 *
 * Computes the five official financial statements required for the
 * Auditor's Report of POS Cursor Cooperative (SCSCC).
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
import Loan from '../database/models/Loan';
import Borrower from '../database/models/Borrower';
import Payment from '../database/models/Payment';
import Expense from '../database/models/Expense';
import SavingsTransaction from '../database/models/SavingsTransaction';
import ShareCapitalTransaction from '../database/models/ShareCapitalTransaction';
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
        loanReceivable: ComparativeAmount;
        savingsLoansReceivable: ComparativeAmount;
        otherReceivables: ComparativeAmount;
        sundryAssets: ComparativeAmount;
        totalCurrentAssets: ComparativeAmount;
        totalAssets: ComparativeAmount;
    };
    /** LIABILITIES */
    liabilities: {
        savingsDeposits: ComparativeAmount;
        shareCapitalPayable: ComparativeAmount;
        otherPayables: ComparativeAmount;
        totalLiabilities: ComparativeAmount;
    };
    /** FUND BALANCE / EQUITY */
    fundBalance: {
        shareCapital: ComparativeAmount;
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
        interestOnLoans: ComparativeAmount;
        serviceCharges: ComparativeAmount;
        membershipFees: ComparativeAmount;
        otherIncome: ComparativeAmount;
        totalRevenues: ComparativeAmount;
    };
    expenses: {
        salariesAndWages: ComparativeAmount;
        officeExpenses: ComparativeAmount;
        depreciationAndAmortization: ComparativeAmount;
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
    dividendsDeclared: ComparativeAmount;
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
    /** Note 3: Loan Receivables */
    loanPortfolio: {
        totalLoansReleased: number;
        totalOutstanding: number;
        numberOfActiveLoans: number;
        averageLoanSize: number;
        numberOfBorrowers: number;
    };
    /** Note 4: Savings Deposits */
    savingsDeposits: {
        totalDeposits: number;
        totalWithdrawals: number;
        netBalance: number;
        numberOfAccounts: number;
    };
    /** Note 5: Share Capital */
    shareCapital: {
        totalSubscribed: number;
        totalPaidUp: number;
        numberOfShareholders: number;
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
        
        const addCmp = (...args: {current: number, prior: number}[]) => ({
            current: args.reduce((s, a) => s + (a?.current || 0), 0),
            prior: args.reduce((s, a) => s + (a?.prior || 0), 0)
        });
        const zeroCmp = { current: 0, prior: 0 };
        
        return {
            year,
            priorYear,
            asOf: new Date(year, 11, 31),
            assets: {
                cashOnHand: gl.assets.cashOnHand,
                cashInBank: gl.assets.cashInBank,
                loanReceivable: gl.assets.loanReceivable,
                savingsLoansReceivable: zeroCmp,
                otherReceivables: zeroCmp,
                sundryAssets: gl.assets.sundryAssets,
                totalCurrentAssets: gl.assets.totalCurrentAssets,
                totalAssets: gl.assets.totalAssets,
            },
            liabilities: {
                savingsDeposits: gl.liabilities.depositLiabilities,
                shareCapitalPayable: gl.liabilities.interestShareCapitalPayable,
                otherPayables: addCmp(gl.liabilities.patronageRefundPayable, gl.liabilities.dueToUnion),
                totalLiabilities: gl.liabilities.totalLiabilities,
            },
            fundBalance: {
                shareCapital: gl.equity.paidUpCapital,
                reserveFund: gl.equity.reserveFund,
                educationFund: gl.equity.educationFund,
                communityDevFund: gl.equity.communityDevFund,
                optionalFund: gl.equity.optionalFund,
                retainedSurplus: gl.equity.retainedSurplus,
                totalFundBalance: gl.equity.totalEquity,
            },
            totalLiabilitiesAndFundBalance: gl.totalLiabilitiesAndEquity
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

        return {
            year,
            priorYear,
            revenues: {
                interestOnLoans: gl.revenues.interestOnLoans,
                serviceCharges: gl.revenues.serviceCharges,
                membershipFees: gl.revenues.membershipFees,
                otherIncome: addCmp(gl.revenues.interestOnInvestments, gl.revenues.miscellaneousIncome),
                totalRevenues: gl.revenues.totalRevenues,
            },
            expenses: {
                salariesAndWages: gl.expenses.salaries,
                officeExpenses: gl.expenses.office,
                depreciationAndAmortization: gl.expenses.depreciation,
                otherExpenses: addCmp(gl.expenses.financingCosts, gl.expenses.communication, gl.expenses.transportation, gl.expenses.taxes, gl.expenses.repairs),
                totalExpenses: gl.expenses.totalExpenses,
            },
            netSurplus: gl.netSurplus,
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
            dividendsDeclared: cmp(0, 0),
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
                    { label: 'Loan Repayments Collected', current: curr.loanRepayments, prior: prior.loanRepayments, inflow: true },
                    { label: 'Operating Expenses Paid', current: curr.operatingExpenses, prior: prior.operatingExpenses, inflow: false },
                ],
                netOperating: cmp(curr.netOperating, prior.netOperating),
            },
            investing: {
                items: [
                    { label: 'Loans Disbursed to Members', current: curr.loansDisbursed, prior: prior.loansDisbursed, inflow: false },
                    { label: 'Savings Deposits Received', current: curr.savingsDeposits, prior: prior.savingsDeposits, inflow: true },
                    { label: 'Savings Withdrawals Paid', current: curr.savingsWithdrawals, prior: prior.savingsWithdrawals, inflow: false },
                ],
                netInvesting: cmp(curr.netInvesting, prior.netInvesting),
            },
            financing: {
                items: [
                    { label: 'Share Capital Contributions', current: curr.shareContributions, prior: prior.shareContributions, inflow: true },
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

        const [payments, expenses, savingsTx, shareTx, loansThisYear] = await Promise.all([
            database.get<Payment>('payments').query(
                Q.where('payment_date', Q.between(start, end)),
                Q.where('deleted_at', null),
            ).fetch(),
            database.get<Expense>('expenses').query(
                Q.where('expense_date', Q.between(start, end)),
                Q.where('deleted_at', null),
            ).fetch(),
            database.get<SavingsTransaction>('savings_transactions').query(
                Q.where('date', Q.between(start, end)),
                Q.where('deleted_at', null),
            ).fetch(),
            database.get<ShareCapitalTransaction>('share_capital_transactions').query(
                Q.where('date', Q.between(start, end)),
                Q.where('deleted_at', null),
            ).fetch(),
            database.get<Loan>('loans').query(
                Q.where('release_date', Q.between(start, end)),
                Q.where('deleted_at', null),
            ).fetch(),
        ]);

        const loanRepayments = payments.reduce((s, p) => s + (p.amount ?? 0), 0);
        const operatingExpenses = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);
        const netOperating = loanRepayments - operatingExpenses;

        const loansDisbursed = loansThisYear.reduce((s, l) => s + (l.principalAmount ?? 0), 0);
        const savingsDeposits = savingsTx.filter(t => t.type === 'deposit').reduce((s, t) => s + (t.amount ?? 0), 0);
        const savingsWithdrawals = savingsTx.filter(t => t.type === 'withdraw_cash' || t.type === 'withdraw_loan').reduce((s, t) => s + (t.amount ?? 0), 0);
        const netInvesting = savingsDeposits - savingsWithdrawals - loansDisbursed;

        const shareContributions = shareTx
            .filter(t => t.transactionType === 'DEPOSIT' || t.transactionType === 'SUBSCRIPTION')
            .reduce((s, t) => s + (t.amount ?? 0), 0);
        const netFinancing = shareContributions;

        const netChange = netOperating + netInvesting + netFinancing;

        // Beginning cash = net change of all prior years (simplified)
        const beginningCash = 0; // Would require pre-app data; left as 0 for now
        const endingCash = beginningCash + netChange;

        return {
            loanRepayments,
            operatingExpenses,
            netOperating,
            loansDisbursed,
            savingsDeposits,
            savingsWithdrawals,
            netInvesting,
            shareContributions,
            netFinancing,
            netChange,
            beginningCash,
            endingCash,
        };
    }

    // ─── Notes to Financial Statements ───────────────────────────────────────

    static async getNotes(year: number): Promise<NotesData> {
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
        const { start, end } = yearRange(year);

        const [activeLoans, allBorrowers, savingsTx, shareTx] = await Promise.all([
            database.get<Loan>('loans').query(
                Q.where('status', 'active'),
                Q.where('deleted_at', null),
            ).fetch(),
            database.get<Borrower>('borrowers').query(
                Q.where('deleted_at', null),
            ).fetch(),
            database.get<SavingsTransaction>('savings_transactions').query(
                Q.where('date', Q.lte(endOfYear)),
                Q.where('deleted_at', null),
            ).fetch(),
            database.get<ShareCapitalTransaction>('share_capital_transactions').query(
                Q.where('date', Q.lte(endOfYear)),
                Q.where('deleted_at', null),
            ).fetch(),
        ]);

        const totalOutstanding = activeLoans.reduce((s, l) => s + (l.principalAmount ?? 0), 0);
        const avgLoanSize = activeLoans.length > 0 ? totalOutstanding / activeLoans.length : 0;

        const savingsBalance = savingsTx.reduce((s, t) => {
            if (t.type === 'deposit') return s + (t.amount ?? 0);
            if (t.type === 'withdraw_cash' || t.type === 'withdraw_loan') return s - (t.amount ?? 0);
            return s;
        }, 0);
        const totalSavingsDeposits = savingsTx.filter(t => t.type === 'deposit').reduce((s, t) => s + (t.amount ?? 0), 0);
        const totalSavingsWithdrawals = savingsTx.filter(t => t.type === 'withdraw_cash' || t.type === 'withdraw_loan').reduce((s, t) => s + (t.amount ?? 0), 0);

        const totalShareCapital = shareTx
            .filter(t => t.transactionType === 'DEPOSIT' || t.transactionType === 'SUBSCRIPTION')
            .reduce((s, t) => s + (t.amount ?? 0), 0);

        // Statutory funds estimate from historical net surplus
        const allPayments = await database.get<Payment>('payments').query(
            Q.where('deleted_at', null),
        ).fetch();
        const allExpenses = await database.get<Expense>('expenses').query(
            Q.where('deleted_at', null),
        ).fetch();
        const historicalSurplus = allPayments.reduce((s, p) => s + (p.amount ?? 0), 0)
            - allExpenses.reduce((s, e) => s + (e.amount ?? 0), 0);

        return {
            year,
            organization: {
                name: COMPANY_NAME_FULL,
                address: 'P-2, Barangay Linao, Ormoc City, Leyte',
                registrationNumber: '[CDA Registration Number]',
                dateRegistered: '[Date of Registration]',
                primaryPurpose: 'To encourage thrift and savings among members, create funds from such savings, and extend credit to members for provident and productive purposes.',
            },
            accountingPolicies: [
                'Basis of Preparation — The financial statements have been prepared in accordance with Philippine Financial Reporting Standards (PFRS) for Small and Medium-sized Entities (SMEs) and the Cooperative Code of the Philippines (R.A. 9520).',
                'Revenue Recognition — Interest income on loans is recognized using the effective interest method over the term of the loan.',
                'Loan Receivables — Loan receivables are stated at amortized cost less allowance for impairment losses.',
                'Savings Deposits — Member savings deposits are recorded at the amount deposited and are repayable on demand.',
                'Share Capital — Share capital represents paid-up subscriptions by members and is carried at historical cost.',
                'Statutory Reserves — Pursuant to R.A. 9520, the cooperative allocates a minimum of 10% of net surplus to the General Reserve Fund and 10% to the Cooperative Education and Training Fund (CETF) before distribution to members.',
                'Income Tax — As a cooperative duly registered under R.A. 9520, the cooperative is exempt from income tax on transactions with members.',
                'Cash and Cash Equivalents — Cash and cash equivalents include cash on hand and deposits with banks with original maturities of three months or less.',
            ],
            loanPortfolio: {
                totalLoansReleased: activeLoans.length,
                totalOutstanding,
                numberOfActiveLoans: activeLoans.length,
                averageLoanSize: avgLoanSize,
                numberOfBorrowers: allBorrowers.length,
            },
            savingsDeposits: {
                totalDeposits: totalSavingsDeposits,
                totalWithdrawals: totalSavingsWithdrawals,
                netBalance: savingsBalance,
                numberOfAccounts: allBorrowers.length,
            },
            shareCapital: {
                totalSubscribed: totalShareCapital,
                totalPaidUp: totalShareCapital,
                numberOfShareholders: shareTx.length > 0
                    ? new Set(shareTx.map(t => t.memberId)).size
                    : 0,
            },
            statutoryFunds: {
                reserveFund: Math.round(historicalSurplus * 0.10 * 100) / 100,
                educationFund: Math.round(historicalSurplus * 0.10 * 100) / 100,
                communityDevFund: Math.round(historicalSurplus * 0.03 * 100) / 100,
                optionalFund: Math.round(historicalSurplus * 0.07 * 100) / 100,
            },
            relatedPartyNote: 'Key management personnel of the cooperative include the Board of Directors and the General Manager. Transactions with related parties are conducted on arm\'s length basis and in accordance with the cooperative\'s policies and the Cooperative Code.',
            eventsAfterReportingPeriod: 'No material events occurred after the reporting period that would require adjustment to or disclosure in these financial statements.',
        };
    }
}
