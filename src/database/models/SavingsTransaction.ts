import { Model } from '@nozbe/watermelondb'
import { field, date, relation } from '@nozbe/watermelondb/decorators'

export default class SavingsTransaction extends Model {
    static table = 'savings_transactions'

    @relation('borrowers', 'borrower_id') borrower: any;
    @field('borrower_id') borrowerId: string;
    @field('type') type: string; // 'deposit', 'withdraw_cash', 'withdraw_loan', 'interest'
    @field('amount') amount: number;
    @field('reference_id') referenceId: string; // ID of the related payment or loan if applicable
    @date('date') date: number;
    @field('notes') notes: string;
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
