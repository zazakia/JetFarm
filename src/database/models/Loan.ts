import { Model } from '@nozbe/watermelondb'
import { field, date, relation, children } from '@nozbe/watermelondb/decorators'

export default class Loan extends Model {
    static table = 'loans'

    @relation('borrowers', 'borrower_id') borrower: any;
    @field('borrower_id') borrowerId: string;
    @field('loan_number') loanNumber: string;
    @field('loan_type') loanType: string;
    @field('principal_amount') principalAmount: number;
    @field('interest_rate') interestRate: number;
    @field('interest_type') interestType: string;
    @field('term') term: number;
    @field('term_unit') termUnit: string;
    @field('frequency') frequency: string;
    @field('total_amount') totalAmount: number;
    @field('installment_amount') installmentAmount: number;
    @field('deposit_amount') depositAmount: number;
    @field('insurance_amount') insuranceAmount: number;
    @field('processing_fee') processingFee: number;
    @field('collection_fee') collectionFee: number;
    @field('notarial_fee') notarialFee: number;
    @field('rod_fee') rodFee: number;
    @field('lto_fee') ltoFee: number;
    @field('udi_rebatable_fee') udiRebatableFee: number;
    @field('vat_on_interest') vatOnInterest: number;
    @field('vat_on_charges') vatOnCharges: number;
    @field('dst_fee') dstFee: number;
    @field('rebate_amount') rebateAmount: number;
    @field('savings_per_payment') savingsPerPayment: number;
    @date('release_date') releaseDate: Date | number;
    @date('first_payment_date') firstPaymentDate: Date | number;
    @date('maturity_date') maturityDate: Date | number;
    @field('status') status: string;
    @field('is_reloan') isReloan: boolean;
    @field('previous_loan_id') previousLoanId: string;
    @field('deducted_amount') deductedAmount: number;
    @field('encoded_by') encodedBy: string;
    @relation('collectors', 'collector_id') collector: any;
    @field('collector_id') collectorId: string;
    @field('batch') loanBatch: number;
    @field('cycle') loanCycle: number;
    @field('savings_amount') savingsAmount: number | null;
    @field('interest_amount') interestAmount: number;
    @field('notes') notes: string;
    @field('dpd') dpd: number;
    @field('aging_bucket') agingBucket: string;
    @relation('loan_applications', 'application_id') application: any;
    @field('application_id') applicationId: string | null;
    @field('is_delinquent') isDelinquent: boolean;
    @date('delinquent_since') delinquentSince: number | null;
    @field('approved_by') approvedBy: string;
    @date('approved_at') approvedAt: number | null;
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;

    @children('payments') payments: any;
    @children('payment_schedules') paymentSchedules: any;
    @children('loan_penalties') penalties: any;
}
