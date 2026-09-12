import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriHarvestLog extends Model {
    static table = 'agri_harvest_logs'

    @field('crop_cycle_id') cropCycleId!: string
    @field('parcel_id') parcelId!: string
    @date('harvest_date') harvestDate!: Date
    @field('batch_number') batchNumber!: string
    @field('gross_weight_kg') grossWeightKg!: number
    @field('tare_weight_kg') tareWeightKg!: number
    @field('net_weight_kg') netWeightKg!: number
    @field('quality_grade') qualityGrade!: string | null
    @field('truck_plate_number') truckPlateNumber!: string | null
    @field('weigh_in_supervisor') weighInSupervisor!: string | null
    @field('photo_uri') photoUri!: string | null
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
