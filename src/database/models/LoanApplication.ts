import { Model } from '@nozbe/watermelondb'
import { field, date, relation, children, readonly } from '@nozbe/watermelondb/decorators'

export default class LoanApplication extends Model {
    static table = 'loan_applications'

    @relation('borrowers', 'borrower_id') borrower: any;
    @field('borrower_id') borrowerId: string;
    @relation('loan_products', 'product_id') product: any;
    @field('product_id') productId: string;
    @field('amount_applied') amountApplied: number;
    @field('amount_approved') amountApproved: number | null;
    @field('purpose') purpose: string | null;
    @date('application_date') applicationDate: number;
    @field('status') status: string;
    @relation('user_profiles', 'approved_by') approvedByRel: any;
    @field('approved_by') approvedBy: string | null;
    @date('approved_at') approvedAt: number | null;
    @field('notes') notes: string | null;
    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;

    @children('guarantors') guarantors: any;
    @children('loans') loans: any;
}
