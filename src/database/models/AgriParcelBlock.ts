import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriParcelBlock extends Model {
    static table = 'agri_parcel_blocks'

    @field('parcel_id') parcelId!: string
    @field('name') name!: string
    @field('code') code!: string | null
    @field('geometry_json') geometryJson!: string // Serialized ParcelGeometry, including holes
    @field('area_hectares') areaHectares!: number
    @field('status') status!: 'active' | 'archived'
    @field('boundary_revision') boundaryRevision!: number
    @field('layout_revision') layoutRevision!: number

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
