import { Model } from '@nozbe/watermelondb'
import { field, date, relation, readonly } from '@nozbe/watermelondb/decorators'

export default class Guarantor extends Model {
    static table = 'guarantors'

    @relation('loans', 'loan_id') loan: any;
    @field('loan_id') loanId: string | null;
    @relation('loan_applications', 'application_id') application: any;
    @field('application_id') applicationId: string | null;
    @field('guarantor_name') guarantorName: string;
    @field('contact_no') contactNo: string | null;
    @field('relationship') relationship: string | null;
    @relation('borrowers', 'member_id') member: any;
    @field('member_id') memberId: string | null;
    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
