import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class BusinessUnit extends Model {
    static table = 'business_units'

    @field('name') name!: string
    @field('slug') slug!: string
    @field('module_id') moduleId!: string
    @field('branch_id') branchId?: string | null
    @field('is_active') isActive!: boolean
    @field('description') description!: string | null
    @field('area_id') areaId!: string | null
    @field('area_supervisor_id') areaSupervisorId!: string | null

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
