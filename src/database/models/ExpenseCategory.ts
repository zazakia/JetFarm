import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class ExpenseCategory extends Model {
    static table = 'expense_categories'

    @field('name') name: string;
    @field('is_active') isActive: boolean;
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
