import { database } from '../database';
import Loan from '../database/models/Loan';
import Borrower from '../database/models/Borrower';
import { ShareCapitalService } from './ShareCapitalService';
import { LoanService } from './LoanService';
import { Q } from '@nozbe/watermelondb';
import { ErrorService } from "./ErrorService";

export interface CreditInvestigationResult {
    isEligible: boolean;
    maxLoanableAmount: number;
    reasons: string[];
    warnings: string[];
}

export class CreditInvestigationService {
    /**
     * Evaluates borrower eligibility for a Petty Cash Loan
     * POS Cursor Policy: Max 75% of share capital, must have >= 10 shares (P1000+)
     */
    static async evaluatePettyCashLoan(borrowerId: string): Promise<CreditInvestigationResult> {
        const reasons: string[] = [];
        const warnings: string[] = [];
        let isEligible = true;
        let maxLoanableAmount = 0;

        try {
            // 1. Check existing loans
            const activeLoans = await this.getActiveLoans(borrowerId);
            const hasActivePettyCash = activeLoans.some(l => l.loanType === 'petty_cash');
            if (hasActivePettyCash) {
                isEligible = false;
                reasons.push("Borrower already has an active Petty Cash Loan. Renewal is only allowed after full payment.");
            }

            const hasDelinquent = await this.hasDelinquentLoans(borrowerId);
            if (hasDelinquent) {
                isEligible = false;
                reasons.push("Borrower has existing delinquent loans. All privileges are frozen.");
            }

            // 2. Check Share Capital
            const shareCapital = await ShareCapitalService.getCurrentBalance(borrowerId);
            if (shareCapital.shares < 10) {
                isEligible = false;
                reasons.push(`Insufficient share capital. Required: 10 shares. Actual: ${shareCapital.shares} shares.`);
            }

            // 3. Calculate max amount
            maxLoanableAmount = shareCapital.amount * 0.75;

        } catch (error) {
            isEligible = false;
            reasons.push("Error during credit investigation evaluation.");
            ErrorService.handleError(error, 'CreditInvestigationService');
        }

        return {
            isEligible,
            maxLoanableAmount,
            reasons,
            warnings
        };
    }

    /**
     * Evaluates borrower eligibility for Livelihood / Salary / Emergency Loans
     * POS Cursor Policy: Max P5,000. Subject to CI and BOD approval.
     */
    static async evaluateStandardCoopLoan(borrowerId: string, loanType: 'livelihood' | 'salary' | 'emergency'): Promise<CreditInvestigationResult> {
        const reasons: string[] = [];
        const warnings: string[] = [];
        let isEligible = true;
        const maxLoanableAmount = 5000; // Fixed maximum for these types

        try {
            const borrower = await database.get<Borrower>('borrowers').find(borrowerId);

            // 1. Check existing loans
            const activeLoans = await this.getActiveLoans(borrowerId);
            const hasSameTypeActive = activeLoans.some(l => l.loanType === loanType);
            if (hasSameTypeActive) {
                isEligible = false;
                reasons.push(`Borrower already has an active ${loanType} loan. Renewal is only allowed after full payment.`);
            }

            const hasDelinquent = await this.hasDelinquentLoans(borrowerId);
            if (hasDelinquent) {
                isEligible = false;
                reasons.push("Borrower has existing delinquent loans. All privileges are frozen.");
            }

            // removed occupation check since it is not in schema
        } catch (error) {
            isEligible = false;
            reasons.push("Error during credit investigation evaluation.");
            ErrorService.handleError(error, 'CreditInvestigationService');
        }

        return {
            isEligible,
            maxLoanableAmount,
            reasons,
            warnings
        };
    }

    /**
     * Checks if a borrower has any delinquent loans
     */
    private static async hasDelinquentLoans(borrowerId: string): Promise<boolean> {
        const loans = await database.get<Loan>('loans').query(
            Q.where('borrower_id', borrowerId),
            Q.where('is_delinquent', true),
            Q.where('deleted_at', null)
        ).fetch();
        
        return loans.length > 0;
    }

    /**
     * Gets active loans for a borrower
     */
    private static async getActiveLoans(borrowerId: string): Promise<Loan[]> {
        return database.get<Loan>('loans').query(
            Q.where('borrower_id', borrowerId),
            Q.where('status', 'active'),
            Q.where('deleted_at', null)
        ).fetch();
    }
}
