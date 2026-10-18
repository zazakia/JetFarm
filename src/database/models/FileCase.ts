import { Model } from '@nozbe/watermelondb'
import { field, date, relation } from '@nozbe/watermelondb/decorators'

export default class FileCase extends Model {
    static table = 'file_cases'

    @relation('loans', 'loan_id') loan!: any;
    @field('loan_id') loanId!: string;
    @relation('borrowers', 'borrower_id') borrower!: any;
    @field('borrower_id') borrowerId!: string;
    @field('case_number') caseNumber!: string;
    @date('filed_date') filedDate!: number;
    @field('status') status!: string; // open | resolved | dismissed
    @field('notes') notes!: string;
    @field('filed_by') filedBy!: string;
    @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt!: number | null;
}
