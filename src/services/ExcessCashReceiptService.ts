import { PdfGenerator } from './PdfGenerator';

export interface ExcessCashLoanInfo {
    borrowerName: string;
    loanNumber: string;
}

export interface ExcessCashReceiptRequest {
    loan?: ExcessCashLoanInfo | null;
    paymentAmount: number;
    amountDueBeforePayment: number;
    paymentDate: Date;
    receiptNumber?: string;
    notes?: string;
    preparedBy?: string;
}

export interface ExcessCashReceiptResult {
    shouldPrint: boolean;
    printed: boolean;
    excessAmount: number;
    error?: Error;
}

export interface ExcessCashReceiptPrinter {
    generateExcessCashReceipt: typeof PdfGenerator.generateExcessCashReceipt;
}

export interface ExcessCashReportPaymentInput {
    id: string;
    borrowerName: string;
    bankName?: string | null;
    bankAccountName?: string | null;
    bankAccountNumber?: string | null;
    loanNumber?: string | null;
    paymentAmount: number;
    currentSalary?: number | null;
    excessCash?: number | null;
    paymentDate: Date | number;
    receiptNumber?: string | null;
}

export interface ExcessCashReportRow {
    id: string;
    borrowerName: string;
    savingsBankAccount: string;
    loanNumber: string;
    receiptNumber: string;
    paymentDate: Date;
    currentSalary: number;
    currentPayment: number;
    excessCash: number;
}

const toError = (error: unknown): Error => error instanceof Error ? error : new Error(String(error));
const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export class ExcessCashReceiptService {
    constructor(
        private readonly printer: ExcessCashReceiptPrinter = PdfGenerator,
        private readonly logger: Pick<Console, 'warn'> = console
    ) {}

    static calculateExcessCash(currentSalary: number, currentPayment: number): number {
        const salary = Number.isFinite(currentSalary) ? currentSalary : 0;
        const payment = Number.isFinite(currentPayment) ? currentPayment : 0;
        return roundCurrency(Math.max(0, salary - payment));
    }

    static formatSavingsBankAccount(input: Pick<ExcessCashReportPaymentInput, 'bankName' | 'bankAccountName' | 'bankAccountNumber'>): string {
        const parts = [input.bankName, input.bankAccountName, input.bankAccountNumber]
            .map(part => String(part || '').trim())
            .filter(Boolean);
        return parts.length > 0 ? parts.join(' / ') : 'No savings bank account on file';
    }

    static buildReportRows(currentSalary: number, payments: ExcessCashReportPaymentInput[]): ExcessCashReportRow[] {
        return payments.map(payment => ({
            id: payment.id,
            borrowerName: payment.borrowerName,
            savingsBankAccount: this.formatSavingsBankAccount(payment),
            loanNumber: payment.loanNumber || 'N/A',
            receiptNumber: payment.receiptNumber || 'N/A',
            paymentDate: payment.paymentDate instanceof Date ? payment.paymentDate : new Date(payment.paymentDate),
            currentSalary: roundCurrency(Number.isFinite(payment.currentSalary as number) ? payment.currentSalary as number : (Number.isFinite(currentSalary) ? currentSalary : 0)),
            currentPayment: roundCurrency(Number.isFinite(payment.paymentAmount) ? payment.paymentAmount : 0),
            excessCash: Number.isFinite(payment.excessCash as number)
                ? roundCurrency(payment.excessCash as number)
                : this.calculateExcessCash(
                    Number.isFinite(payment.currentSalary as number) ? payment.currentSalary as number : (Number.isFinite(currentSalary) ? currentSalary : 0),
                    payment.paymentAmount
                ),
        }));
    }

    async printIfNeeded(request: ExcessCashReceiptRequest): Promise<ExcessCashReceiptResult> {
        const paymentAmount = Number.isFinite(request.paymentAmount) ? request.paymentAmount : 0;
        const amountDueBeforePayment = Number.isFinite(request.amountDueBeforePayment) ? request.amountDueBeforePayment : 0;
        const excessAmount = roundCurrency(Math.max(0, paymentAmount - amountDueBeforePayment));
        const shouldPrint = excessAmount > 0 && amountDueBeforePayment > 0 && !!request.loan;

        if (!shouldPrint) {
            return { shouldPrint: false, printed: false, excessAmount };
        }

        try {
            await this.printer.generateExcessCashReceipt({
                borrowerName: request.loan!.borrowerName,
                loanNumber: request.loan!.loanNumber,
                receiptNumber: request.receiptNumber,
                paymentDate: request.paymentDate,
                amountReceived: paymentAmount,
                amountDue: amountDueBeforePayment,
                amountRemaining: excessAmount,
                remarks: request.notes || 'Excess cash from loan payment',
                recipientName: request.loan!.borrowerName,
                preparedBy: request.preparedBy || 'System',
            });
            return { shouldPrint, printed: true, excessAmount };
        } catch (error) {
            const normalized = toError(error);
            this.logger.warn('[ExcessCashReceiptService] Excess cash receipt printing failed:', normalized);
            return { shouldPrint, printed: false, excessAmount, error: normalized };
        }
    }
}
