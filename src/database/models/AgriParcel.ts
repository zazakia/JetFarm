import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriParcel extends Model {
    static table = 'agri_parcels'

    @field('name') name!: string
    @field('code') code!: string | null
    @field('land_owner_id') landOwnerId!: string
    @field('area_hectares') areaHectares!: number
    @field('location_address') locationAddress!: string | null
    @field('gps_coordinates') gpsCoordinates!: string | null // JSON coordinates string
    @field('gps_exclusions') gpsExclusions!: string | null // JSON array of exclusion rings
    @field('boundary_revision') boundaryRevision!: number
    @field('layout_revision') layoutRevision!: number
    @date('boundary_saved_at') boundarySavedAt!: Date | null
    @field('soil_type') soilType!: string | null
    @field('status') status!: string // available, land_prep, planted, harvesting, fallow

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
