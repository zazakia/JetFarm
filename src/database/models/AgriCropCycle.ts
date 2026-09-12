import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriCropCycle extends Model {
    static table = 'agri_crop_cycles'

    @field('cycle_code') cycleCode!: string
    @field('parcel_id') parcelId!: string
    @field('investor_id') investorId!: string | null
    @field('crop_type') cropType!: string
    @field('variety') variety!: string | null
    @date('planting_date') plantingDate!: Date
    @date('target_harvest_date') targetHarvestDate!: Date | null
    @date('actual_harvest_date') actualHarvestDate!: Date | null
    @field('area_planted_ha') areaPlantedHa!: number
    @field('status') status!: string // planning, land_prep, planted, growing, harvesting, completed, closed
    @field('expected_yield_kg') expectedYieldKg!: number
    @field('total_actual_yield_kg') totalActualYieldKg!: number
    @field('capital_allocated') capitalAllocated!: number
    @field('land_owner_rate_per_kg') landOwnerRatePerKg!: number
    @field('land_owner_guaranteed_min') landOwnerGuaranteedMin!: number
    @field('offtake_price_per_kg') offtakePricePerKg!: number
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
