import { addFrequency, addNextDaySkipSunday, addFrequencySkipSunday } from '../utils/dates';
import { SeriesService } from './SeriesService';
import { computeDocumentaryStamp } from '../utils/documentaryStamp';

export interface ScheduleRow {
    number: number;
    dueDate: Date;
    scheduledAmount: number;
    principal: number;
    interest: number;
    fees?: number; // deposit + insurance
    balance: number;
}

export type InstitutionalLoanType =
    | 'petty_cash'
    | 'livelihood'
    | 'salary'
    | 'emergency';

export interface InstitutionalLoanChargeInput {
    loanType: InstitutionalLoanType;
    principal: number;
    monthlyRatePercent: number;
    term: number;
    termUnit: string;
    frequency: string;
    releaseDate?: Date;
    processingFee?: number;
    collectionFee?: number;
    notarialFee?: number;
    insuranceFee?: number;
    rodFee?: number;
    ltoFee?: number;
    udiRebatableFee?: number;
    outstandingBalance?: number;
    savingsPerPayment?: number;
    rebatePerPayment?: number;
}

export interface InstitutionalLoanBreakdown {
    loanType: InstitutionalLoanType;
    principal: number;
    monthlyRatePercent: number;
    termMonths: number;
    interestCharges: number;
    vatOnInterest: number;
    processingFee: number;
    collectionFee: number;
    notarialFee: number;
    insuranceFee: number;
    rodFee: number;
    ltoFee: number;
    udiRebatableFee: number;
    totalOtherCharges: number;
    vatOnOtherCharges: number;
    dstFee: number;
    totalTaxes: number;
    outstandingBalance: number;
    totalDeductions: number;
    netProceeds: number;
    principalPerPayment: number;
    interestPerPayment: number;
    vatPerPayment: number;
    savingsPerPayment: number;
    rebatePerPayment: number;
}

export interface StandardLoanBreakdown {
    arf: number;
    cpf: number;
    mem: number;
    lhf: number;
    rsf: number;
    docStamp: number;
    previousBalance: number;
    totalDeductions: number;
    netProceeds: number;
}

export interface LoanCalcResult {
    totalAmount: number;
    installmentAmount: number;
    numPayments: number;
    totalInterest: number;
    totalFees: number;
    schedule: ScheduleRow[];
    firstPaymentDate: Date;
    maturityDate: Date;
    institutionalBreakdown?: InstitutionalLoanBreakdown;
}

export class LoanCalculatorService {
    private static readonly VAT_RATE = 0.0;

    private static roundCurrency(value: number): number {
        return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
    }

    static termInMonths(term: number, termUnit: string): number {
        if (termUnit === 'days') return term / 30;
        if (termUnit === 'weeks') return term / 4;
        return term;
    }

    static paymentsForFrequency(term: number, termUnit: string, frequency: string): number {
        if (termUnit === 'days') {
            switch (frequency) {
                case 'daily': return term;
                case 'weekly': return Math.ceil(term / 7);
                case 'bi_monthly': return Math.ceil(term / 15);
                case 'monthly': return Math.ceil(term / 30);
                default: return Math.ceil(term / 30);
            }
        } else if (termUnit === 'weeks') {
            switch (frequency) {
                case 'daily': return term * 7;
                case 'weekly': return term;
                case 'bi_monthly': return Math.max(1, Math.round(term / 2));
                case 'monthly': return Math.max(1, Math.round(term / 4));
                default: return term;
            }
        } else {
            switch (frequency) {
                case 'daily': return Math.round(term * 30);
                case 'weekly': return Math.round(term * 4); // Aligned with Excel (24 weeks for 6 months)
                case 'bi_monthly': return term * 2;
                case 'monthly': return term;
                default: return term;
            }
        }
    }

    static firstPaymentDate(releaseDate: Date, frequency: string): Date {
        // First payment is the next day after release, skipping Sunday
        return addNextDaySkipSunday(releaseDate);
    }

    static calculateFlat(
        principal: number,
        ratePercent: number,
        term: number,
        termUnit: string,
        frequency: string,
        releaseDate: Date = new Date(),
        totalDeposit: number = 0,
        totalInsurance: number = 0
    ): LoanCalcResult {
        const numPayments = this.paymentsForFrequency(term, termUnit, frequency);
        
        // Excel Logic: Interest is flat for the whole period (Rate per Term)
        const totalInterest = principal * (ratePercent / 100);
        
        // Now treating inputs as TOTALS for the whole loan
        const totalFees = totalDeposit + totalInsurance;
        const totalAmount = principal + totalInterest + totalFees;
        
        const installmentAmount = totalAmount / numPayments;
        const firstPaymentDate = this.firstPaymentDate(releaseDate, frequency);

        const schedule: ScheduleRow[] = [];
        let currentDate = firstPaymentDate;
        let balance = totalAmount;

        for (let i = 1; i <= numPayments; i++) {
            const periodInterest = totalInterest / numPayments;
            const periodPrincipal = principal / numPayments;
            const periodFees = totalFees / numPayments;
            balance -= installmentAmount;

            schedule.push({
                number: i,
                dueDate: new Date(currentDate),
                scheduledAmount: installmentAmount,
                principal: periodPrincipal,
                interest: periodInterest,
                fees: periodFees,
                balance: Math.max(0, balance),
            });

            currentDate = addFrequencySkipSunday(currentDate, frequency);
        }

        const maturityDate = schedule[schedule.length - 1]?.dueDate ?? firstPaymentDate;

        return {
            totalAmount,
            installmentAmount,
            numPayments,
            totalInterest,
            totalFees,
            schedule,
            firstPaymentDate,
            maturityDate,
        };
    }

    static calculateDiminishing(
        principal: number,
        annualRatePercent: number,
        term: number,
        termUnit: string,
        frequency: string,
        releaseDate: Date = new Date(),
        totalDeposit: number = 0,
        totalInsurance: number = 0
    ): LoanCalcResult {
        const numPayments = this.paymentsForFrequency(term, termUnit, frequency);
        const termInMonths = termUnit === 'days' ? term / 30 : term;
        const periodicRate = (annualRatePercent / 100) / (numPayments / termInMonths * 12);

        let installmentAmount: number;
        if (periodicRate === 0) {
            installmentAmount = principal / numPayments;
        } else {
            installmentAmount =
                (principal * periodicRate * Math.pow(1 + periodicRate, numPayments)) /
                (Math.pow(1 + periodicRate, numPayments) - 1);
        }

        // Divide total fees by numPayments
        const totalFees = totalDeposit + totalInsurance;
        const periodicFees = totalFees / numPayments;
        const finalInstallment = installmentAmount + periodicFees;

        const firstPaymentDate = this.firstPaymentDate(releaseDate, frequency);
        const schedule: ScheduleRow[] = [];
        let balance = principal;
        let totalInterest = 0;
        let currentDate = firstPaymentDate;

        for (let i = 1; i <= numPayments; i++) {
            const interest = balance * periodicRate;
            const principalPart = installmentAmount - interest;
            balance = Math.max(0, balance - principalPart);
            
            totalInterest += interest;

            schedule.push({
                number: i,
                dueDate: new Date(currentDate),
                scheduledAmount: finalInstallment,
                principal: principalPart,
                interest: interest,
                fees: periodicFees,
                balance: balance + (numPayments - i) * periodicFees, // Rough balance including pending fees
            });

            currentDate = addFrequencySkipSunday(currentDate, frequency);
        }

        const maturityDate = schedule[schedule.length - 1]?.dueDate ?? firstPaymentDate;

        return {
            totalAmount: (installmentAmount + periodicFees) * numPayments,
            installmentAmount: finalInstallment,
            numPayments,
            totalInterest,
            totalFees,
            schedule,
            firstPaymentDate,
            maturityDate,
        };
    }

    static calculate(
        principal: number,
        ratePercent: number,
        term: number,
        termUnit: string,
        interestType: string,
        frequency: string,
        releaseDate: Date = new Date(),
        totalDeposit: number = 0,
        totalInsurance: number = 0
    ): LoanCalcResult {
        if (interestType === 'diminishing') {
            return this.calculateDiminishing(principal, ratePercent, term, termUnit, frequency, releaseDate, totalDeposit, totalInsurance);
        }
        return this.calculateFlat(principal, ratePercent, term, termUnit, frequency, releaseDate, totalDeposit, totalInsurance);
    }

    static calculateInstitutionalLoan(params: InstitutionalLoanChargeInput): LoanCalcResult {
        const numPayments = this.paymentsForFrequency(params.term, params.termUnit, params.frequency);
        const termMonths = this.termInMonths(params.term, params.termUnit);
        const principal = this.roundCurrency(params.principal);
        const monthlyRate = (params.monthlyRatePercent || 0) / 100;

        const interestCharges = this.roundCurrency(principal * monthlyRate * termMonths);
        const vatOnInterest = this.roundCurrency(interestCharges * this.VAT_RATE);
        const processingFee = this.roundCurrency(params.processingFee ?? principal * 0.03);
        const collectionFee = this.roundCurrency(params.collectionFee ?? 0);
        const notarialFee = this.roundCurrency(params.notarialFee ?? 300);
        const insuranceFee = this.roundCurrency(params.insuranceFee ?? 0);
        const rodFee = this.roundCurrency(params.rodFee ?? 0);
        const ltoFee = this.roundCurrency(params.ltoFee ?? 0);
        const udiRebatableFee = this.roundCurrency(params.udiRebatableFee ?? 0);
        const outstandingBalance = this.roundCurrency(params.outstandingBalance ?? 0);
        const savingsPerPayment = this.roundCurrency(params.savingsPerPayment ?? 0);
        const rebatePerPayment = this.roundCurrency(params.rebatePerPayment ?? 0);

        const totalOtherCharges = this.roundCurrency(
            processingFee + collectionFee + notarialFee + insuranceFee + rodFee + ltoFee
        );
        const vatOnOtherCharges = this.roundCurrency(totalOtherCharges * this.VAT_RATE);
        const dstFee = computeDocumentaryStamp(principal).amount;
        const totalTaxes = this.roundCurrency(vatOnInterest + vatOnOtherCharges + dstFee);

        const totalDeductions = this.roundCurrency(
            vatOnOtherCharges + processingFee + collectionFee + notarialFee +
            insuranceFee + rodFee + ltoFee + outstandingBalance
        );
        const netProceeds = Math.max(0, this.roundCurrency(principal - totalDeductions));

        const firstPaymentDate = this.firstPaymentDate(params.releaseDate ?? new Date(), params.frequency);
        const amortizedLoanBase = principal + interestCharges + vatOnInterest;
        const principalPerPayment = numPayments > 0 ? this.roundCurrency(principal / numPayments) : 0;
        const interestPerPayment = numPayments > 0 ? this.roundCurrency(interestCharges / numPayments) : 0;
        const vatPerPayment = numPayments > 0 ? this.roundCurrency(vatOnInterest / numPayments) : 0;
        const installmentAmount = numPayments > 0
            ? this.roundCurrency((amortizedLoanBase / numPayments) + savingsPerPayment - rebatePerPayment)
            : 0;
        const totalSavings = savingsPerPayment * numPayments;
        const totalRebate = rebatePerPayment * numPayments;
        const totalAmount = this.roundCurrency(amortizedLoanBase + totalSavings - totalRebate);

        const schedule: ScheduleRow[] = [];
        let currentDate = firstPaymentDate;
        let balance = totalAmount;

        for (let i = 1; i <= numPayments; i++) {
            balance = this.roundCurrency(balance - installmentAmount);
            schedule.push({
                number: i,
                dueDate: new Date(currentDate),
                scheduledAmount: installmentAmount,
                principal: principal / numPayments,
                interest: interestCharges / numPayments,
                fees: (vatOnInterest / numPayments) + savingsPerPayment - rebatePerPayment,
                balance: Math.max(0, balance),
            });
            currentDate = addFrequencySkipSunday(currentDate, params.frequency);
        }

        const maturityDate = schedule[schedule.length - 1]?.dueDate ?? firstPaymentDate;

        return {
            totalAmount,
            installmentAmount,
            numPayments,
            totalInterest: interestCharges,
            totalFees: this.roundCurrency(vatOnInterest + totalSavings - totalRebate),
            schedule,
            firstPaymentDate,
            maturityDate,
            institutionalBreakdown: {
                loanType: params.loanType,
                principal,
                monthlyRatePercent: params.monthlyRatePercent,
                termMonths,
                interestCharges,
                vatOnInterest,
                processingFee,
                collectionFee,
                notarialFee,
                insuranceFee,
                rodFee,
                ltoFee,
                udiRebatableFee,
                totalOtherCharges,
                vatOnOtherCharges,
                dstFee,
                totalTaxes,
                outstandingBalance,
                totalDeductions,
                netProceeds,
                principalPerPayment,
                interestPerPayment,
                vatPerPayment,
                savingsPerPayment,
                rebatePerPayment,
            },
        };
    }

    static principalFromTargetInstitutionalPayment(params: {
        targetPayment: number;
        monthlyRatePercent: number;
        term: number;
        termUnit: string;
        frequency: string;
        savingsPerPayment?: number;
        rebatePerPayment?: number;
    }): number {
        const numPayments = this.paymentsForFrequency(params.term, params.termUnit, params.frequency);
        const termMonths = this.termInMonths(params.term, params.termUnit);
        const monthlyRate = (params.monthlyRatePercent || 0) / 100;
        const targetBasePayment = (params.targetPayment || 0) - (params.savingsPerPayment || 0) + (params.rebatePerPayment || 0);
        const totalRepaymentFactor = 1 + (monthlyRate * termMonths * (1 + this.VAT_RATE));

        if (numPayments <= 0 || totalRepaymentFactor <= 0 || targetBasePayment <= 0) {
            return 0;
        }

        return this.roundCurrency((targetBasePayment * numPayments) / totalRepaymentFactor);
    }

    static calculateNetProceeds(principal: number, deposit: number, insurance: number, previousBalance: number): number {
        return this.calculateStandardBreakdown(principal, previousBalance).netProceeds;
    }

    static calculateStandardBreakdown(principal: number, previousBalance: number = 0): StandardLoanBreakdown {
        const arf = principal * 0.02;
        const cpf = principal * 0.04;
        const mem = 100;
        const lhf = 100;
        const rsf = 60;
        const docStamp = 45;
        const totalDeductions = arf + cpf + mem + lhf + rsf + docStamp + (previousBalance || 0);
        const netProceeds = Math.max(0, principal - totalDeductions);
        
        return {
            arf,
            cpf,
            mem,
            lhf,
            rsf,
            docStamp,
            previousBalance,
            totalDeductions,
            netProceeds
        };
    }

    static principalFromLoanCode(code: string): number {
        if (!code || typeof code !== 'string') return 0;
        const match = code.toUpperCase().match(/^LC(\d+)K$/);
        if (match) {
            const thousands = parseInt(match[1], 10);
            return thousands * 1000;
        }
        return 0;
    }

    static generateLoanNumber(): string {
        return SeriesService.generateLoanNumber();
    }

    static getFormulaBasis(interestType: string = 'flat') {
        const isFlat = interestType === 'flat';
        return {
            interest: isFlat 
                ? 'Principal × (Rate / 100)' 
                : 'Reducing Balance Calculation based on Annual Rate',
            totalLoan: 'Principal + Total Interest + Total Savings + Total Insurance',
            installment: 'Total Loan / Number of Payments',
            netRelease: 'Principal - Previous Loan Balance (if renewal)',
            savings: 'Allocated portion of total savings per payment',
            insurance: 'Allocated portion of total insurance per payment'
        };
    }
}
