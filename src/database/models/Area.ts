import { Model } from '@nozbe/watermelondb'
import { field, date, relation, readonly, children } from '@nozbe/watermelondb/decorators'

export default class Area extends Model {
    static table = 'areas'

    @field('name') name: string;
    @field('code') code: string | null;
    @relation('areas', 'parent_area_id') parentArea: any;
    @field('parent_area_id') parentAreaId: string | null;
    @relation('user_profiles', 'ao_id') accountOfficer: any;
    @field('ao_id') aoId: string | null;
    @field('is_active') isActive: boolean;
    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;

    @children('areas') childAreas: any;
    @children('borrowers') borrowers: any;
    @children('collection_groups') collectionGroups: any;
}
