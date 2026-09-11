import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class ActionLog extends Model {
    static table = 'action_logs'

    @field('entity_type') entityType: string;
    @field('entity_id') entityId: string;
    @field('action') action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
    @field('performed_by') performedBy: string;
    @field('old_data') oldData: string; // JSON string
    @field('new_data') newData: string; // JSON string
    @date('timestamp') timestamp: number;
    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
