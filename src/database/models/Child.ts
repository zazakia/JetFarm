import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Child extends Model {
    static table = 'children'

    @field('member_id') memberId: string;
    @field('full_name') fullName: string;
    @date('date_of_birth') dateOfBirth: number | null;
    @field('age') age: number | null;

    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
