import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class StoreAudit extends Model {
    static table = 'store_audits'

    @field('branch_id') branchId!: string
    @date('audit_date') auditDate!: Date
    @field('auditor_name') auditorName!: string
    @field('cleanliness_score') cleanlinessScore!: number | null
    @field('food_quality_score') foodQualityScore!: number | null
    @field('staff_compliance_score') staffComplianceScore!: number | null
    @field('inventory_accuracy_score') inventoryAccuracyScore!: number | null
    @field('overall_score') overallScore!: number | null
    @field('findings') findings!: string | null
    @field('action_items') actionItems!: string | null
    @field('photo_urls') photoUrls!: string | null
    /** open | resolved | escalated */
    @field('status') status!: string
    @date('resolved_at') resolvedAt!: Date | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
