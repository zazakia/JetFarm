import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Dependent extends Model {
    static table = 'dependents'

    @field('member_id') memberId: string;
    @field('name') name: string;
    @field('age') age: number | null;
    @field('relationship') relationship: string | null;
    @date('date_of_birth') dateOfBirth: number | null;

    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
