import Loan from '../database/models/Loan';
import Payment from '../database/models/Payment';
import PaymentSchedule from '../database/models/PaymentSchedule';
import Borrower from '../database/models/Borrower';
import LoanPenalty from '../database/models/LoanPenalty';
import { differenceInDays } from 'date-fns';
import { isLoanActive } from '../utils/activeLoanPolicy';

export class KpiCalculator {
    static computePAR(
        loans: Loan[],
        schedules: PaymentSchedule[],
        payments: Payment[],
        daysThreshold: number,
        now: Date = new Date()
    ): { par: number; glp: number } {
        const activeLoans = loans.filter(l => isLoanActive(l.status));
        const glp = activeLoans.reduce((s, l) => s + l.principalAmount, 0);

        const overdueLoanIds = new Set<string>();
        for (const sched of schedules) {
            if (sched.status === 'pending' || sched.status === 'partial' || sched.status === 'late') {
                const overdueDays = differenceInDays(now, new Date(sched.dueDate));
                if (overdueDays > daysThreshold) {
                    overdueLoanIds.add(sched.loanId);
                }
            }
        }

        const paymentTotals = payments.reduce((acc, p) => {
            acc[p.loanId] = (acc[p.loanId] || 0) + p.amount;
            return acc;
        }, {} as Record<string, number>);

        const overdueOutstanding = activeLoans
            .filter(l => overdueLoanIds.has(l.id))
            .reduce((s, l) => {
                const paid = paymentTotals[l.id] || 0;
                const totalReceivable = (l.totalAmount || l.principalAmount || 0);
                const paidRatio = totalReceivable > 0 ? Math.min(1, paid / totalReceivable) : 0;
                return s + Math.max(0, l.principalAmount * (1 - paidRatio));
            }, 0);

        const rawPar = glp > 0 ? (overdueOutstanding / glp) * 100 : 0;
        return {
            par: Math.min(100, Math.max(0, rawPar)),
            glp,
        };
    }

    static computeGLP(loans: Loan[]): number {
        return loans
            .filter(l => isLoanActive(l.status))
            .reduce((s, l) => s + l.principalAmount, 0);
    }

    static computeROA(netIncome: number, totalAssets: number): number {
        return totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0;
    }

    static computeROE(netIncome: number, totalEquity: number): number {
        return totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0;
    }

    static computeOSS(
        operatingRevenue: number,
        operatingExpenses: number,
        financialCosts: number,
        loanLossProvisions: number
    ): number {
        const denominator = operatingExpenses + financialCosts + loanLossProvisions;
        return denominator > 0 ? (operatingRevenue / denominator) * 100 : 0;
    }

    static computeFSS(
        operatingRevenue: number,
        operatingExpenses: number,
        financialCosts: number,
        provisions: number,
        subsidyAdj: number = 0,
        inflationAdj: number = 0
    ): number {
        const denominator = operatingExpenses + financialCosts + provisions + subsidyAdj + inflationAdj;
        return denominator > 0 ? (operatingRevenue / denominator) * 100 : 0;
    }

    static computeCollectionEfficiency(totalCollected: number, totalDue: number): number {
        return totalDue > 0 ? (totalCollected / totalDue) * 100 : 0;
    }

    static computeOER(operatingExpenses: number, glp: number): number {
        return glp > 0 ? (operatingExpenses / glp) * 100 : 0;
    }

    static computeBorrowersPerLO(activeBorrowers: number, loanOfficerCount: number): number {
        return loanOfficerCount > 0 ? activeBorrowers / loanOfficerCount : 0;
    }

    static computeDebtToEquity(totalLiabilities: number, totalEquity: number): number {
        return totalEquity > 0 ? totalLiabilities / totalEquity : 0;
    }

    static computeCAR(totalEquity: number, riskWeightedAssets: number): number {
        return riskWeightedAssets > 0 ? (totalEquity / riskWeightedAssets) * 100 : 0;
    }

    static computeWomenRatio(borrowers: Borrower[]): number {
        const total = borrowers.length;
        const female = borrowers.filter(b => b.gender === 'female').length;
        return total > 0 ? (female / total) * 100 : 0;
    }

    static computeAvgLoanSize(glp: number, activeBorrowers: number): number {
        return activeBorrowers > 0 ? glp / activeBorrowers : 0;
    }

    static computeOutstandingBalance(loans: Loan[], payments: Payment[], penalties?: LoanPenalty[], collectorId?: string): number {
        const filteredLoans = collectorId
            ? loans.filter(l => l.collectorId === collectorId && isLoanActive(l.status))
            : loans.filter(l => isLoanActive(l.status));

        const paymentTotals = payments.reduce((acc, p) => {
            acc[p.loanId] = (acc[p.loanId] || 0) + p.amount;
            return acc;
        }, {} as Record<string, number>);

        const penaltyTotals = (penalties || []).reduce((acc, p) => {
            acc[p.loanId] = (acc[p.loanId] || 0) + p.amount;
            return acc;
        }, {} as Record<string, number>);

        return filteredLoans.reduce((sum, loan) => {
            const paid = paymentTotals[loan.id] || 0;
            const penaltyTotal = penaltyTotals[loan.id] || 0;

            return sum + Math.max(0, loan.totalAmount + penaltyTotal - paid);
        }, 0);
    }

    static computeInterestIncome(payments: Payment[], loans: Loan[]): number {
        const paymentTotals = payments.reduce((acc, p) => {
            acc[p.loanId] = (acc[p.loanId] || 0) + p.amount;
            return acc;
        }, {} as Record<string, number>);

        return loans.reduce((sum, loan) => {
            const totalReceivable = loan.totalAmount || 0;
            if (totalReceivable <= 0) return sum;

            const loanPaid = paymentTotals[loan.id] || 0;

            const explicitInterest = (loan as any).interestAmount || 0;
            const derivedInterest = Math.max(
                0,
                totalReceivable - (loan.principalAmount || 0) - ((loan as any).depositAmount || 0) - ((loan as any).insuranceAmount || 0)
            );
            const interestReceivable = explicitInterest > 0 ? explicitInterest : derivedInterest;
            const recognizedInterest = loanPaid * (interestReceivable / totalReceivable);

            return sum + Math.min(interestReceivable, Math.max(0, recognizedInterest));
        }, 0);
    }
}
