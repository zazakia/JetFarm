import Loan from '../database/models/Loan';
import Payment from '../database/models/Payment';
import PaymentSchedule from '../database/models/PaymentSchedule';
import Expense from '../database/models/Expense';
import Remittance from '../database/models/Remittance';
import FinancialSnapshot from '../database/models/FinancialSnapshot';
import Collector from '../database/models/Collector';
import Borrower from '../database/models/Borrower';
import SavingsTransaction from '../database/models/SavingsTransaction';
import LoanPenalty from '../database/models/LoanPenalty';
import { CashService } from './CashService';
import { differenceInDays, format } from 'date-fns';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import { KpiCalculator } from './KpiCalculator';
import { ErrorService } from "./ErrorService";

const toTimestamp = (value: number | Date | null | undefined): number => {
    if (value instanceof Date) return value.getTime();
    return typeof value === 'number' ? value : 0;
};

export interface MfiKpiData {
    portfolioAtRisk: number;
    collectionEfficiency: number;
    totalActiveLoans: number;
    totalOutstandingPrincipal: number;
    oss: number;
    fss: number;
    oer: number;
}

export interface OverdueWatchlistItem {
    scheduleId: string;
    loanId: string;
    borrowerId?: string;
    borrowerName: string;
    dueDate: number;
    amountDue: number;
    overdueDays: number;
    loanBalance: number;
    phoneNumber?: string;
}

export interface AgingCluster {
    label: string;
    min: number;
    max: number;
    amount: number;
    count: number;
    color: string;
}

export interface AgingBucketDetail {
    id: string;
    borrowerName: string;
    phoneNumber?: string;
    loanNumber: string;
    loanId: string;
    dueDate: number;
    amountDue: number;
    overdueDays: number;
    loanBalance: number;
}

export interface CollectorEfficiencyData {
    userId: string;
    name: string;
    collected: number;
    target: number;
    cashHeld: number;
    efficiency: number;
}

export interface IncomeStatementData {
    operatingRevenue: number;
    remittedRevenue: number;
    operatingExpenses: number;
    opExBreakdown: Record<string, number>;
    financialCosts: number;
    loanLossProvisions: number;
    netIncome: number;
    savingsInterestExpense: number;
}

export interface DisbursementItem {
    id: string;
    loanNumber: string;
    borrowerName: string;
    principalAmount: number;
    insuranceAmount: number;
    releaseDate: number;
    status: string;
}

export interface SavingsReportData {
    summary: {
        currentBalance: number;
        totalDeposits: number;
        totalWithdrawals: number;
        totalInterest: number;
        recentVelocity: number;
        typeBreakdown: Record<string, number>;
    };
    activity: any[];
    topSavers: any[];
}

export interface RenewalReportData {
    count: {
        total: number;
        renewed: number;
        new: number;
        rate: number;
    };
    volume: {
        renewed: number;
        new: number;
    };
    trend: any[];
}

export interface AdvancedKpiData {
    roa: number;
    roe: number;
    debtToEquity: number;
    car: number;
    womenRatio: number;
    borrowersPerLo: number;
    avgLoanSize: number;
}

export interface BalanceSheetData {
    assets: {
        loanPortfolio: number;
        cashOnHand: number;
        cashInTransit: number;
        otherAssets: number;
        totalAssets: number;
    };
    liabilities: {
        borrowings: number;
        savingsDeposits: number;
        totalLiabilities: number;
    };
    equity: {
        paidInCapital: number;
        totalEquity: number;
    };
    asOf: number;
}

export interface ActiveLoanReportItem {
    id: string;
    borrowerId?: string;
    clientName: string;
    address: string;
    collectorName: string;
    collectorId: string;
    loanAmount: number;
    totalLoanBalance: number;
    dayCollectionOutstanding: number;
    dateRelease: number;
    endDate: number | null;
    agings: {
        notDue: number;
        day1_45: number;
        day46_60: number;
        day61_90: number;
        day91_180: number;
    };
    efficiency: {
        totalCollected: number;
        expectedCollected: number;
    };
}

export class MfiKpiService {
    constructor(private db = database) {}

    private static defaultInstance = new MfiKpiService();

    static async getKpiSummary(): Promise<MfiKpiData> {
        return this.defaultInstance.getKpiSummary();
    }

    static async getOverdueWatchlist(): Promise<OverdueWatchlistItem[]> {
        return this.defaultInstance.getOverdueWatchlist();
    }

    static async getAgingClusters(): Promise<AgingCluster[]> {
        return this.defaultInstance.getAgingClusters();
    }

    static async getAgingBucketDetails(minDays: number, maxDays: number): Promise<AgingBucketDetail[]> {
        return this.defaultInstance.getAgingBucketDetails(minDays, maxDays);
    }

    static async getCollectorEfficiency(): Promise<CollectorEfficiencyData[]> {
        return this.defaultInstance.getCollectorEfficiency();
    }

    static async getIncomeStatement(startDate: number, endDate: number): Promise<IncomeStatementData | null> {
        return this.defaultInstance.getIncomeStatement(startDate, endDate);
    }

    static async getBalanceSheet(): Promise<BalanceSheetData | null> {
        return this.defaultInstance.getBalanceSheet();
    }

    static async getDisbursements(startDate: number, endDate: number): Promise<DisbursementItem[]> {
        return this.defaultInstance.getDisbursements(startDate, endDate);
    }

    static async getAdvancedKpis(): Promise<AdvancedKpiData> {
        return this.defaultInstance.getAdvancedKpis();
    }

    static async getSavingsReportData(): Promise<SavingsReportData | null> {
        return this.defaultInstance.getSavingsReportData();
    }

    static async getRenewalReportData(): Promise<RenewalReportData | null> {
        return this.defaultInstance.getRenewalReportData();
    }

    static async getActiveLoansReportData(): Promise<ActiveLoanReportItem[]> {
        return this.defaultInstance.getActiveLoansReportData();
    }

    async getKpiSummary(): Promise<MfiKpiData> {
        try {
            const loans = await this.db.collections.get<Loan>('loans')
                .query(Q.where('deleted_at', null), Q.where('status', Q.oneOf(['active', 'defaulted'])))
                .fetch();

            const schedules = await this.db.collections.get<PaymentSchedule>('payment_schedules')
                .query(Q.where('deleted_at', null), Q.where('status', Q.notEq('paid')))
                .fetch();

            const loanIds = loans.map(l => l.id);
            const payments = loanIds.length > 0 
                ? await this.db.collections.get<Payment>('payments')
                    .query(Q.where('deleted_at', null), Q.where('loan_id', Q.oneOf(loanIds)))
                    .fetch()
                : [];

            const penalties = loanIds.length > 0 
                ? await this.db.collections.get<LoanPenalty>('loan_penalties')
                    .query(Q.where('deleted_at', null), Q.where('loan_id', Q.oneOf(loanIds)))
                    .fetch()
                : [];

            const expenses = await this.db.collections.get<Expense>('expenses').query(Q.where('deleted_at', null)).fetch();

            const par = KpiCalculator.computePAR(loans, schedules, payments, 30);
            const glp = KpiCalculator.computeGLP(loans);
            const outstanding = KpiCalculator.computeOutstandingBalance(loans, payments, penalties);

            const interestIncome = KpiCalculator.computeInterestIncome(payments, loans);
            const operatingRevenue = interestIncome;

            const operatingExpenses = expenses.reduce((s, e) => s + e.amount, 0);

            const oss = KpiCalculator.computeOSS(operatingRevenue, operatingExpenses, 0, 0);
            const fss = KpiCalculator.computeFSS(operatingRevenue, operatingExpenses, 0, 0, 0, 0);
            const oer = KpiCalculator.computeOER(operatingExpenses, glp);

            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

            const monthSchedules = await this.db.collections.get<PaymentSchedule>('payment_schedules')
                .query(Q.where('deleted_at', null), Q.where('due_date', Q.gte(startOfMonth)))
                .fetch();

            const monthPayments = await this.db.collections.get<Payment>('payments')
                .query(Q.where('deleted_at', null), Q.where('payment_date', Q.gte(startOfMonth)))
                .fetch();

            const totalDue = monthSchedules.reduce((s, row) => s + row.scheduledAmount, 0);
            const totalCollected = monthPayments.reduce((s, row) => s + row.amount, 0);
            const collectionEfficiency = KpiCalculator.computeCollectionEfficiency(totalCollected, totalDue);

            return {
                portfolioAtRisk: par.par / 100,
                collectionEfficiency: collectionEfficiency / 100,
                totalActiveLoans: loans.filter(l => l.status === 'active').length,
                totalOutstandingPrincipal: outstanding,
                oss: oss / 100,
                fss: fss / 100,
                oer: oer / 100,
            };
        } catch (e) {
            ErrorService.handleError(e, '[MfiKpiService] Error getting KPI summary:');
            return {
                portfolioAtRisk: 0,
                collectionEfficiency: 0,
                totalActiveLoans: 0,
                totalOutstandingPrincipal: 0,
                oss: 0,
                fss: 0,
                oer: 0,
            };
        }
    }

    async getOverdueWatchlist(): Promise<OverdueWatchlistItem[]> {
        try {
            const now = new Date();
            const schedules = await this.db.collections.get<PaymentSchedule>('payment_schedules')
                .query(Q.where('deleted_at', null), 
                    Q.and(
                        Q.where('status', Q.oneOf(['pending', 'partial', 'late'])),
                        Q.where('due_date', Q.lt(now.getTime()))
                    )
                )
                .fetch();

            if (schedules.length === 0) return [];

            const loanIds = Array.from(new Set(schedules.map(s => s.loanId)));
            const loans = await this.db.collections.get<Loan>('loans')
                .query(Q.where('deleted_at', null), Q.where('id', Q.oneOf(loanIds)))
                .fetch();

            const borrowerIds = Array.from(new Set(loans.map(l => l.borrowerId)));
            const borrowers = await this.db.collections.get<Borrower>('borrowers')
                .query(Q.where('deleted_at', null), Q.where('id', Q.oneOf(borrowerIds)))
                .fetch();

            const payments = await this.db.collections.get<Payment>('payments')
                .query(Q.where('deleted_at', null), Q.where('loan_id', Q.oneOf(loanIds)))
                .fetch();

            const penalties = await this.db.collections.get<LoanPenalty>('loan_penalties')
                .query(Q.where('deleted_at', null), Q.where('loan_id', Q.oneOf(loanIds)))
                .fetch();

            return schedules.map(sched => {
                const loan = loans.find(l => l.id === sched.loanId);
                const borrower = borrowers.find(b => b.id === loan?.borrowerId);
                const overdueDays = differenceInDays(now, new Date(sched.dueDate));
                
                const principalPaid = payments
                    .filter(p => p.loanId === loan?.id)
                    .reduce((sum, p) => sum + p.amount, 0);

                const penaltyTotal = penalties
                    .filter(p => p.loanId === loan?.id)
                    .reduce((sum, p) => sum + p.amount, 0);

                const balance = Math.max(0, (loan?.totalAmount || 0) + penaltyTotal - principalPaid);

                return {
                    scheduleId: sched.id,
                    loanId: sched.loanId,
                    borrowerId: borrower?.id,
                    borrowerName: borrower?.fullName || 'Unknown',
                    dueDate: toTimestamp(sched.dueDate),
                    amountDue: sched.scheduledAmount,
                    overdueDays,
                    loanBalance: balance,
                    phoneNumber: borrower?.decryptedPhone,
                };
            }).sort((a, b) => b.overdueDays - a.overdueDays).slice(0, 10);

        } catch (e) {
            ErrorService.handleError(e, '[MfiKpiService] Error getting overdue watchlist:');
            return [];
        }
    }

    async getAgingClusters(): Promise<AgingCluster[]> {
        try {
            const now = new Date();
            const loans = await this.db.collections.get<Loan>('loans').query(Q.where('deleted_at', null), Q.where('status', Q.oneOf(['active', 'defaulted']))).fetch();
            const schedules = await this.db.collections.get<PaymentSchedule>('payment_schedules').query(Q.where('deleted_at', null)).fetch();
            const payments = await this.db.collections.get<Payment>('payments').query(Q.where('deleted_at', null)).fetch();
            const penalties = await this.db.collections.get<LoanPenalty>('loan_penalties').query(Q.where('deleted_at', null)).fetch();

            // Build lookup Maps (O(N)) to replace per-loan filter calls (O(N×M))
            const schedulesByLoanId = new Map<string, PaymentSchedule[]>();
            schedules.forEach(s => schedulesByLoanId.set(s.loanId, [...(schedulesByLoanId.get(s.loanId) || []), s]));
            const paymentsByLoanId = new Map<string, Payment[]>();
            payments.forEach(p => paymentsByLoanId.set(p.loanId, [...(paymentsByLoanId.get(p.loanId) || []), p]));
            const penaltiesByLoanId = new Map<string, LoanPenalty[]>();
            penalties.forEach(p => penaltiesByLoanId.set(p.loanId, [...(penaltiesByLoanId.get(p.loanId) || []), p]));

            const buckets = [
                { label: '1-7 Days', min: 1, max: 7, amount: 0, count: 0, color: '#3B82F6' },
                { label: '8-30 Days', min: 8, max: 30, amount: 0, count: 0, color: '#F59E0B' },
                { label: '31-60 Days', min: 31, max: 60, amount: 0, count: 0, color: '#EF4444' },
                { label: '61+ Days', min: 61, max: 9999, amount: 0, count: 0, color: '#991B1B' },
            ];

            for (const loan of loans) {
                // O(1) Map lookups instead of O(N) filter calls
                const loanSchedules = schedulesByLoanId.get(loan.id) || [];
                const loanPayments = paymentsByLoanId.get(loan.id) || [];
                const loanPenalties = penaltiesByLoanId.get(loan.id) || [];

                const balances = this.getLoanScheduleBalances(loan, loanSchedules, loanPayments, loanPenalties, now);
                
                let loanHasOverdue = false;
                balances.forEach(b => {
                    if (b.balance <= 0) return;
                    const bucket = buckets.find(bucket => b.daysOverdue >= bucket.min && b.daysOverdue <= bucket.max);
                    if (bucket) {
                        bucket.amount += b.balance;
                        loanHasOverdue = true;
                    }
                });
                
                if (loanHasOverdue) {
                    const distinctBuckets = new Set(
                        balances
                            .filter(b => b.balance > 0)
                            .map(b => buckets.find(bucket => b.daysOverdue >= bucket.min && b.daysOverdue <= bucket.max))
                            .filter(Boolean)
                    );
                    distinctBuckets.forEach((bucket: any) => bucket.count++);
                }
            }

            return buckets;
        } catch (e) {
            ErrorService.handleError(e, '[MfiKpiService] Error getting aging clusters:');
            return [];
        }
    }

    async getAgingBucketDetails(minDays: number, maxDays: number): Promise<AgingBucketDetail[]> {
        try {
            const now = new Date();
            const loans = await this.db.collections.get<Loan>('loans').query(Q.where('deleted_at', null), Q.where('status', Q.oneOf(['active', 'defaulted']))).fetch();
            const schedules = await this.db.collections.get<PaymentSchedule>('payment_schedules').query(Q.where('deleted_at', null)).fetch();
            const payments = await this.db.collections.get<Payment>('payments').query(Q.where('deleted_at', null)).fetch();
            const penalties = await this.db.collections.get<LoanPenalty>('loan_penalties').query(Q.where('deleted_at', null)).fetch();
            const borrowers = await this.db.collections.get<Borrower>('borrowers').query(Q.where('deleted_at', null)).fetch();

            // Build lookup Maps (O(N)) to replace per-loan filter calls (O(N×M))
            const schedulesByLoanId = new Map<string, PaymentSchedule[]>();
            schedules.forEach(s => schedulesByLoanId.set(s.loanId, [...(schedulesByLoanId.get(s.loanId) || []), s]));
            const paymentsByLoanId = new Map<string, Payment[]>();
            payments.forEach(p => paymentsByLoanId.set(p.loanId, [...(paymentsByLoanId.get(p.loanId) || []), p]));
            const penaltiesByLoanId = new Map<string, LoanPenalty[]>();
            penalties.forEach(p => penaltiesByLoanId.set(p.loanId, [...(penaltiesByLoanId.get(p.loanId) || []), p]));
            const borrowersById = new Map<string, Borrower>();
            borrowers.forEach(b => borrowersById.set(b.id, b));

            const results: any[] = [];

            for (const loan of loans) {
                // O(1) Map lookups instead of O(N) filter/find calls
                const loanSchedules = schedulesByLoanId.get(loan.id) || [];
                const loanPayments = paymentsByLoanId.get(loan.id) || [];
                const loanPenalties = penaltiesByLoanId.get(loan.id) || [];
                const borrower = borrowersById.get(loan.borrowerId);

                const balances = this.getLoanScheduleBalances(loan, loanSchedules, loanPayments, loanPenalties, now);
                
                balances.forEach(b => {
                    if (b.balance > 0 && b.daysOverdue >= minDays && b.daysOverdue <= maxDays) {
                        results.push({
                            id: b.schedule.id,
                            borrowerName: borrower?.fullName || 'Unknown',
                            phoneNumber: borrower?.decryptedPhone,
                            loanNumber: loan.loanNumber,
                            loanId: loan.id,
                    dueDate: toTimestamp(b.schedule.dueDate),
                            amountDue: b.balance,
                            overdueDays: b.daysOverdue,
                            loanBalance: b.balance,
                        });
                    }
                });
            }

            return results.sort((a, b) => b.overdueDays - a.overdueDays);
        } catch (e) {
            ErrorService.handleError(e, '[MfiKpiService] Error getting aging bucket details:');
            return [];
        }
    }

    async getCollectorEfficiency(): Promise<CollectorEfficiencyData[]> {
        try {
            const loans = await this.db.collections.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
            const payments = await this.db.collections.get<Payment>('payments').query(Q.where('deleted_at', null)).fetch();
            const schedules = await this.db.collections.get<PaymentSchedule>('payment_schedules').query(Q.where('deleted_at', null)).fetch();
            const users = await this.db.collections.get<Collector>('collectors').query(Q.where('deleted_at', null)).fetch();

            const now = new Date().getTime();
            const startOfMonthAt = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

            // O(N) grouping
            const loansByCollector = new Map<string, Loan[]>();
            loans.forEach(l => {
                const list = loansByCollector.get(l.collectorId) || [];
                list.push(l);
                loansByCollector.set(l.collectorId, list);
            });

            const paymentsByCollector = new Map<string, Payment[]>();
            payments.forEach(p => {
                if (p.paymentDate >= startOfMonthAt) {
                    const list = paymentsByCollector.get(p.collectorId) || [];
                    list.push(p);
                    paymentsByCollector.set(p.collectorId, list);
                }
            });

            const schedulesByLoanId = new Map<string, PaymentSchedule[]>();
            schedules.forEach(s => {
                const dueDate = s.dueDate as number;
                if (dueDate >= startOfMonthAt && dueDate <= now) {
                    const list = schedulesByLoanId.get(s.loanId) || [];
                    list.push(s);
                    schedulesByLoanId.set(s.loanId, list);
                }
            });

            const efficiencyData: CollectorEfficiencyData[] = [];
            for (const user of users) {
                const userLoans = loansByCollector.get(user.id) || [];
                const monthPayments = paymentsByCollector.get(user.id) || [];

                const collected = monthPayments.reduce((sum, p) => sum + p.amount, 0);

                let target = 0;
                userLoans.forEach(loan => {
                    const loanSchedules = schedulesByLoanId.get(loan.id) || [];
                    target += loanSchedules.reduce((sum, s) => sum + s.scheduledAmount, 0);
                });

                const cashHeld = await CashService.getCollectorBalance(user.id);

                efficiencyData.push({
                    userId: user.id,
                    name: user.fullName || 'Collector',
                    collected,
                    target,
                    cashHeld,
                    efficiency: target > 0 ? (collected / target) * 100 : 100,
                });
            }

            return efficiencyData.sort((a, b) => b.efficiency - a.efficiency);
        } catch (e) {
            ErrorService.handleError(e, '[MfiKpiService] Error getting collector efficiency:');
            return [];
        }
    }

    async getIncomeStatement(startDate: number, endDate: number): Promise<IncomeStatementData | null> {
        try {
            const expenses = await this.db.collections.get<Expense>('expenses')
                .query(Q.where('deleted_at', null), 
                    Q.where('expense_date', Q.between(startDate, endDate))
                ).fetch();

            const payments = await this.db.collections.get<Payment>('payments')
                .query(Q.where('deleted_at', null), 
                    Q.where('payment_date', Q.between(startDate, endDate))
                ).fetch();
            
            const loans = await this.db.collections.get<Loan>('loans').query(Q.where('deleted_at', null), 
                Q.where('status', Q.oneOf(['active', 'paid', 'defaulted']))
            ).fetch();

            const opExBreakdown: any = {};
            let totalOperatingExpenses = 0;
            expenses.forEach(e => {
                const cat = e.category || 'Other';
                opExBreakdown[cat] = (opExBreakdown[cat] || 0) + e.amount;
                totalOperatingExpenses += e.amount;
            });

            const totalOperatingRevenue = KpiCalculator.computeInterestIncome(payments, loans);

            const remittances = await this.db.collections.get<Remittance>('remittances')
                .query(Q.where('deleted_at', null), 
                    Q.where('status', 'approved'),
                    Q.where('remittance_date', Q.between(startDate, endDate))
                ).fetch();
            
            const totalRemittedInPeriod = remittances.reduce((s, r) => s + r.amount, 0);

            const savingsInterestTxs = await this.db.collections.get<SavingsTransaction>('savings_transactions')
                .query(Q.where('deleted_at', null), 
                    Q.where('type', 'interest'),
                    Q.where('date', Q.between(startDate, endDate))
                ).fetch();
            const savingsInterestExpense = savingsInterestTxs.reduce((s, tx) => s + tx.amount, 0);

            const snapshots = await this.db.collections.get<FinancialSnapshot>('financial_snapshots')
                .query(Q.where('deleted_at', null), 
                    Q.where('snapshot_date', Q.between(startDate, endDate))
                ).fetch();
            
            const baseFinancialCosts = snapshots.reduce((s, snap) => s + snap.financialCosts, 0);
            const financialCosts = baseFinancialCosts + savingsInterestExpense;
            const loanLossProvisions = snapshots.reduce((s, snap) => s + snap.loanLossReserve, 0);

            const netIncome = totalOperatingRevenue - totalOperatingExpenses - financialCosts - loanLossProvisions;

            return {
                operatingRevenue: totalOperatingRevenue,
                remittedRevenue: totalRemittedInPeriod,
                operatingExpenses: totalOperatingExpenses,
                opExBreakdown,
                financialCosts,
                loanLossProvisions,
                netIncome,
                savingsInterestExpense
            };
        } catch (e) {
            ErrorService.handleError(e, '[MfiKpiService] Error generating income statement:');
            return null;
        }
    }

    async getBalanceSheet(): Promise<BalanceSheetData | null> {
        try {
            const loans = await this.db.collections.get<Loan>('loans').query(Q.where('deleted_at', null), 
                Q.where('status', Q.oneOf(['active', 'defaulted']))
            ).fetch();
            const payments = await this.db.collections.get<Payment>('payments').query(Q.where('deleted_at', null)).fetch();
            const penalties = await this.db.collections.get<LoanPenalty>('loan_penalties').query(Q.where('deleted_at', null)).fetch();
            
            const outstandingPrincipal = KpiCalculator.computeOutstandingBalance(loans, payments, penalties);
            const cashOnHand = await CashService.getCurrentBalance();
            
            const collectors = await this.db.collections.get<Collector>('collectors').query(Q.where('deleted_at', null)).fetch();
            let cashInTransit = 0;
            for (const c of collectors) {
                cashInTransit += await CashService.getCollectorBalance(c.id);
            }

            const snapshots = await this.db.collections.get<FinancialSnapshot>('financial_snapshots')
                .query(Q.where('deleted_at', null)).fetch();
            snapshots.sort((a, b) => b.snapshotDate - a.snapshotDate);
            const latest = snapshots.length > 0 ? snapshots[0] : null;

            const assets = {
                loanPortfolio: outstandingPrincipal,
                cashOnHand: cashOnHand,
                cashInTransit: cashInTransit,
                otherAssets: latest ? Math.max(0, latest.totalAssets - outstandingPrincipal - cashOnHand - cashInTransit) : 0,
                totalAssets: (latest ? latest.totalAssets : (outstandingPrincipal + cashOnHand + cashInTransit))
            };

            const savingsTxs = await this.db.collections.get<SavingsTransaction>('savings_transactions').query(Q.where('deleted_at', null)).fetch();
            let totalSavingsDeposits = 0;
            const withdrawalTypes = ['WITHDRAWAL', 'WITHDRAW', 'WITHDRAW_CASH', 'WITHDRAW_LOAN', 'REDEMPTION', 'REVERSAL'];
            savingsTxs.forEach(tx => {
                if (!withdrawalTypes.includes((tx.type || '').toUpperCase())) totalSavingsDeposits += tx.amount;
                else totalSavingsDeposits -= tx.amount;
            });

            const liabilities = {
                borrowings: latest ? latest.totalLiabilities : 0,
                savingsDeposits: totalSavingsDeposits,
                totalLiabilities: (latest ? latest.totalLiabilities : 0) + totalSavingsDeposits
            };

            const equity = {
                paidInCapital: latest ? latest.totalEquity : (assets.totalAssets - liabilities.totalLiabilities),
                totalEquity: latest ? latest.totalEquity : (assets.totalAssets - liabilities.totalLiabilities)
            };

            return { assets, liabilities, equity, asOf: new Date().getTime() };
        } catch (e) {
            ErrorService.handleError(e, '[MfiKpiService] Error generating balance sheet:');
            return null;
        }
    }

    async getDisbursements(startDate: number, endDate: number): Promise<DisbursementItem[]> {
        try {
            const loans = await this.db.collections.get<Loan>('loans')
                .query(Q.where('deleted_at', null), 
                    Q.where('release_date', Q.between(startDate, endDate)),
                    Q.where('status', Q.oneOf(['active', 'paid', 'defaulted']))
                ).fetch();
            
            const borrowerIds = Array.from(new Set(loans.map(l => l.borrowerId)));
            const borrowers = await this.db.collections.get<Borrower>('borrowers')
                .query(Q.where('deleted_at', null), Q.where('id', Q.oneOf(borrowerIds)))
                .fetch();

            return loans.map(loan => {
                const borrower = borrowers.find(b => b.id === loan.borrowerId);
                return {
                    id: loan.id,
                    loanNumber: loan.loanNumber,
                    borrowerName: borrower?.fullName || 'Unknown',
                    principalAmount: loan.principalAmount,
                    insuranceAmount: loan.insuranceAmount,
                    releaseDate: toTimestamp(loan.releaseDate),
                    status: loan.status
                };
            }).sort((a, b) => b.releaseDate - a.releaseDate);
        } catch (e) {
            ErrorService.handleError(e, '[MfiKpiService] Error getting disbursements:');
            return [];
        }
    }

    async getAdvancedKpis(): Promise<AdvancedKpiData> {
        try {
            const loans = await this.db.collections.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
            const borrowers = await this.db.collections.get<Borrower>('borrowers').query(Q.where('deleted_at', null)).fetch();
            const users = await this.db.collections.get<Collector>('collectors').query(Q.where('deleted_at', null)).fetch();
            
            const activeLoans = loans.filter(l => l.status === 'active' || l.status === 'defaulted');
            const glp = activeLoans.reduce((s, l) => s + l.principalAmount, 0);
            const activeBorrowersCount = new Set(activeLoans.map(l => l.borrowerId)).size;
            
            const womenRatio = KpiCalculator.computeWomenRatio(borrowers);
            const borrowersPerLo = KpiCalculator.computeBorrowersPerLO(activeBorrowersCount, users.length);
            const avgLoanSize = KpiCalculator.computeAvgLoanSize(glp, activeBorrowersCount);

            const snapshots = await this.db.collections.get<FinancialSnapshot>('financial_snapshots').query(Q.where('deleted_at', null)).fetch();
            snapshots.sort((a, b) => b.snapshotDate - a.snapshotDate);
            const latest = snapshots.length > 0 ? snapshots[0] : null;

            const now = new Date().getTime();
            const start = now - (30 * 24 * 60 * 60 * 1000);
            const incomeStmt = await this.getIncomeStatement(start, now);
            const netIncome = incomeStmt?.netIncome || 0;

            const totalAssets = latest ? latest.totalAssets : glp * 1.2;
            const totalEquity = latest ? latest.totalEquity : glp * 0.8;
            const totalLiab = latest ? latest.totalLiabilities : totalAssets - (totalEquity as number);
            const rwa = latest ? latest.riskWeightedAssets : glp;

            const roa = KpiCalculator.computeROA(netIncome, totalAssets);
            const roe = KpiCalculator.computeROE(netIncome, totalEquity as number);
            const debtToEquity = KpiCalculator.computeDebtToEquity(totalLiab, totalEquity as number);
            const car = KpiCalculator.computeCAR(totalEquity as number, rwa || 1);

            return { roa, roe, debtToEquity, car, womenRatio, borrowersPerLo, avgLoanSize };
        } catch (e) {
            ErrorService.handleError(e, '[MfiKpiService] Error getting advanced KPIs:');
            return { roa: 0, roe: 0, debtToEquity: 0, car: 0, womenRatio: 0, borrowersPerLo: 0, avgLoanSize: 0 };
        }
    }

    async getSavingsReportData(): Promise<SavingsReportData | null> {
        try {
            const savingsTxs = await this.db.collections.get<SavingsTransaction>('savings_transactions').query(Q.where('deleted_at', null)).fetch();
            const borrowers = await this.db.collections.get<Borrower>('borrowers').query(Q.where('deleted_at', null)).fetch();

            let totalDeposits = 0;
            let totalWithdrawals = 0;
            let totalInterest = 0;
            const typeBreakdown: Record<string, number> = {
                deposit: 0,
                withdraw_cash: 0,
                withdraw_loan: 0,
                interest: 0
            };

            const withdrawalTypes = ['WITHDRAWAL', 'WITHDRAW', 'WITHDRAW_CASH', 'WITHDRAW_LOAN', 'REDEMPTION', 'REVERSAL'];
            savingsTxs.forEach(tx => {
                const t = (tx.type || '').toUpperCase();
                if (t === 'INTEREST') {
                    totalInterest += tx.amount;
                    typeBreakdown.interest += tx.amount;
                } else if (withdrawalTypes.includes(t)) {
                    totalWithdrawals += tx.amount;
                    if (tx.type === 'withdraw_loan') typeBreakdown.withdraw_loan += tx.amount;
                    else typeBreakdown.withdraw_cash += tx.amount;
                } else {
                    totalDeposits += tx.amount;
                    typeBreakdown.deposit += tx.amount;
                }
            });

            const currentBalance = (totalDeposits + totalInterest) - totalWithdrawals;

            const thirtyDaysAgo = new Date().getTime() - (30 * 24 * 60 * 60 * 1000);
            const recentTxs = savingsTxs
                .filter(tx => tx.date >= thirtyDaysAgo)
                .sort((a, b) => b.date - a.date);

            const recentVelocity = recentTxs.reduce((sum, tx) => {
                if (tx.type === 'deposit' || tx.type === 'interest') return sum + tx.amount;
                return sum - tx.amount;
            }, 0);

            const activity = recentTxs.slice(0, 20).map(tx => {
                const borrower = borrowers.find(b => b.id === tx.borrowerId);
                return {
                    id: tx.id,
                    borrowerName: borrower?.fullName || 'Unknown',
                    type: tx.type,
                    amount: tx.amount,
                    date: tx.date,
                    notes: tx.notes
                };
            });

            const borrowerBalances: Record<string, number> = {};
            savingsTxs.forEach(tx => {
                const bId = tx.borrowerId;
                if (!borrowerBalances[bId]) borrowerBalances[bId] = 0;
                if (tx.type === 'deposit' || tx.type === 'interest') borrowerBalances[bId] += tx.amount;
                else borrowerBalances[bId] -= tx.amount;
            });

            const topSavers = Object.entries(borrowerBalances)
                .map(([id, balance]) => {
                    const borrower = borrowers.find(b => b.id === id);
                    return {
                        id,
                        name: borrower?.fullName || 'Unknown',
                        balance
                    };
                })
                .sort((a, b) => b.balance - a.balance)
                .slice(0, 10);

            return {
                summary: {
                    currentBalance,
                    totalDeposits,
                    totalWithdrawals,
                    totalInterest,
                    recentVelocity,
                    typeBreakdown
                },
                activity,
                topSavers
            };
        } catch (e) {
            ErrorService.handleError(e, '[MfiKpiService] Error getting savings report data:');
            return null;
        }
    }

    async getRenewalReportData(): Promise<RenewalReportData | null> {
        try {
            const allLoans = await this.db.collections.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
            
            const totalLoans = allLoans.length;
            const reloans = allLoans.filter(l => l.isReloan);
            const newLoans = allLoans.filter(l => !l.isReloan);

            const reloanRate = totalLoans > 0 ? (reloans.length / totalLoans) * 100 : 0;

            const monthlyStats: Record<string, { new: number; renewed: number; total: number }> = {};
            
            allLoans.forEach(l => {
                const month = format(l.releaseDate, 'yyyy-MM');
                if (!monthlyStats[month]) monthlyStats[month] = { new: 0, renewed: 0, total: 0 };
                
                if (l.isReloan) monthlyStats[month].renewed += l.principalAmount;
                else monthlyStats[month].new += l.principalAmount;
                monthlyStats[month].total += l.principalAmount;
            });

            const trend = Object.entries(monthlyStats)
                .map(([month, stats]) => ({
                    month,
                    ...stats
                }))
                .sort((a, b) => a.month.localeCompare(b.month))
                .slice(-6);

            return {
                count: {
                    total: totalLoans,
                    renewed: reloans.length,
                    new: newLoans.length,
                    rate: reloanRate
                },
                volume: {
                    renewed: reloans.reduce((sum, l) => sum + l.principalAmount, 0),
                    new: newLoans.reduce((sum, l) => sum + l.principalAmount, 0)
                },
                trend
            };
        } catch (e) {
            ErrorService.handleError(e, '[MfiKpiService] Error getting renewal report data:');
            return null;
        }
    }

    async getActiveLoansReportData(): Promise<ActiveLoanReportItem[]> {
        try {
            const loans = await this.db.collections.get<Loan>('loans').query(Q.where('deleted_at', null), 
                Q.where('status', Q.oneOf(['active', 'defaulted']))
            ).fetch();

            const borrowers = await this.db.collections.get<Borrower>('borrowers').query(Q.where('deleted_at', null)).fetch();
            const users = await this.db.collections.get<Collector>('collectors').query(Q.where('deleted_at', null)).fetch();
            const schedules = await this.db.collections.get<PaymentSchedule>('payment_schedules').query(Q.where('deleted_at', null)).fetch();
            const payments = await this.db.collections.get<Payment>('payments').query(Q.where('deleted_at', null)).fetch();
            const penalties = await this.db.collections.get<LoanPenalty>('loan_penalties').query(Q.where('deleted_at', null)).fetch();

            // Build lookup Maps (O(N)) to replace per-loan filter/find calls (O(N×M))
            const borrowersById = new Map<string, Borrower>();
            borrowers.forEach(b => borrowersById.set(b.id, b));
            const collectorsById = new Map<string, Collector>();
            users.forEach(u => collectorsById.set(u.id, u));
            const schedulesByLoanId = new Map<string, PaymentSchedule[]>();
            schedules.forEach(s => schedulesByLoanId.set(s.loanId, [...(schedulesByLoanId.get(s.loanId) || []), s]));
            const paymentsByLoanId = new Map<string, Payment[]>();
            payments.forEach(p => paymentsByLoanId.set(p.loanId, [...(paymentsByLoanId.get(p.loanId) || []), p]));
            const penaltiesByLoanId = new Map<string, LoanPenalty[]>();
            penalties.forEach(p => penaltiesByLoanId.set(p.loanId, [...(penaltiesByLoanId.get(p.loanId) || []), p]));

            const now = new Date();

            return loans.map(loan => {
                // O(1) Map lookups instead of O(N) filter/find calls
                const borrower = borrowersById.get(loan.borrowerId);
                const collector = collectorsById.get(loan.collectorId);
                const loanSchedules = schedulesByLoanId.get(loan.id) || [];
                const loanPayments = paymentsByLoanId.get(loan.id) || [];
                const loanPenalties = penaltiesByLoanId.get(loan.id) || [];

                const scheduleBalances = this.getLoanScheduleBalances(loan, loanSchedules, loanPayments, loanPenalties, now);
                const totalLoanBalance = scheduleBalances.reduce((sum, b) => sum + b.balance, 0);
                
                const releaseDate = toTimestamp(loan.releaseDate);
                const dRelease = new Date(releaseDate);
                const dayCollectionOutstanding = releaseDate ? differenceInDays(now, dRelease) : 0;
                
                let notDue = 0;
                let day1_45 = 0;
                let day46_60 = 0;
                let day61_90 = 0;
                let day91_180 = 0;

                // Sum up balances into mutually exclusive buckets
                scheduleBalances.forEach(b => {
                    if (b.balance <= 0) return;

                    if (b.daysOverdue < 1) {
                        notDue += b.balance;
                    } else if (b.daysOverdue >= 1 && b.daysOverdue <= 45) {
                        day1_45 += b.balance;
                    } else if (b.daysOverdue >= 46 && b.daysOverdue <= 60) {
                        day46_60 += b.balance;
                    } else if (b.daysOverdue >= 61 && b.daysOverdue <= 90) {
                        day61_90 += b.balance;
                    } else if (b.daysOverdue >= 91) {
                        day91_180 += b.balance;
                    }
                });

                const pastSchedules = loanSchedules.filter(s => new Date(s.dueDate).getTime() <= now.getTime());
                const expectedCollected = pastSchedules.reduce((sum, s) => sum + s.scheduledAmount, 0);
                const totalCollected = loanPayments.reduce((sum, p) => sum + p.amount, 0);

                const maxDueDate = loanSchedules.length > 0
                    ? Math.max(...loanSchedules.map(s => new Date(s.dueDate).getTime()))
                    : null;

                return {
                    id: loan.id,
                    borrowerId: borrower?.id,
                    clientName: borrower?.fullName || 'Unknown',
                    address: borrower?.address || '',
                    collectorName: collector?.fullName || 'Unassigned',
                    collectorId: collector?.id || '',
                    loanAmount: loan.principalAmount || 0,
                    totalLoanBalance,
                    dayCollectionOutstanding,
                    dateRelease: releaseDate,
                    endDate: maxDueDate,
                    agings: {
                        notDue,
                        day1_45,
                        day46_60,
                        day61_90,
                        day91_180
                    },
                    efficiency: {
                        totalCollected,
                        expectedCollected
                    }
                };

            }).sort((a, b) => b.dateRelease - a.dateRelease);

        } catch (e) {
            ErrorService.handleError(e, '[MfiKpiService] Error getting active loans report:');
            return [];
        }
    }



    private getLoanScheduleBalances(
        loan: Loan,
        schedules: PaymentSchedule[],
        payments: Payment[],
        penalties: LoanPenalty[],
        now: Date = new Date()
    ): { schedule: PaymentSchedule; balance: number; daysOverdue: number }[] {
        const sortedSchedules = [...schedules].sort((a, b) => (a.dueDate as number) - (b.dueDate as number));
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        const penaltyTotal = penalties.reduce((sum, p) => sum + p.amount, 0);
        
        let remainingPaid = totalPaid;
        
        // Distribution Pool 1: Schedules (Gross amount)
        const balances = sortedSchedules.map(s => {
            const amount = s.scheduledAmount || 0;
            const paid = Math.min(remainingPaid, amount);
            remainingPaid -= paid;
            
            return {
                schedule: s,
                balance: Math.max(0, amount - paid),
                daysOverdue: differenceInDays(now, new Date(s.dueDate))
            };
        });
        
        // Distribution Pool 2: Penalties (Any remaining payment applies to penalties)
        const remainingPenalty = Math.max(0, penaltyTotal - remainingPaid);
        if (remainingPenalty > 0) {
            // Penalties are typically considered "due now" if any schedule is overdue, 
            // or we assign them to the oldest overdue bucket.
            const overdueBalances = balances.filter(b => b.daysOverdue > 0);
            const maxOverdue = overdueBalances.length > 0 
                ? Math.max(...overdueBalances.map(b => b.daysOverdue)) 
                : 0;
            
            // Add a virtual entry for the penalty balance
            balances.push({
                schedule: { id: 'penalty', dueDate: now } as any, 
                balance: remainingPenalty,
                daysOverdue: maxOverdue
            });
        }
        
        return balances;
    }
}
