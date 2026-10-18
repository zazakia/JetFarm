import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class BoardResolution extends Model {
    static table = 'board_resolutions'

    @field('resolution_number') resolutionNumber!: string;
    @field('title') title!: string;
    @field('description') description!: string | null;
    @date('resolution_date') resolutionDate!: number;
    @field('type') type!: string | null;
    @field('status') status!: string | null;
    @field('approved_by') approvedBy!: string | null;
    @field('reference_entity_type') referenceEntityType!: string | null;
    @field('reference_entity_id') referenceEntityId!: string | null;

    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt!: number | null;
}
