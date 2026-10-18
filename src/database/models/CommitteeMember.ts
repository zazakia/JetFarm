import { Model } from '@nozbe/watermelondb'
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators'

export default class CommitteeMember extends Model {
    static table = 'committee_members'

    @relation('committees', 'committee_id') committee!: any;
    @field('committee_id') committeeId!: string;
    @relation('borrowers', 'member_id') member!: any;
    @field('member_id') memberId!: string;
    @field('position') position!: string | null;
    @date('term_start') termStart!: number | null;
    @date('term_end') termEnd!: number | null;
    @field('is_active') isActive!: boolean | null;

    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt!: number | null;
}
