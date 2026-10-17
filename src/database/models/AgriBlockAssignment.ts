import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export type BlockAssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'cancelled'

export default class AgriBlockAssignment extends Model {
    static table = 'agri_block_assignments'

    @readonly @field('block_id') blockId!: string
    @readonly @field('worker_id') workerId!: string
    @readonly @field('crop_cycle_id') cropCycleId!: string | null
    @readonly @field('task') task!: string
    @readonly @date('start_date') startDate!: Date
    @readonly @date('due_date') dueDate!: Date | null
    @field('status') status!: BlockAssignmentStatus
    @field('progress_percent') progressPercent!: number
    @readonly @field('created_by') createdBy!: string
    @readonly @field('assigned_geometry_snapshot') assignedGeometrySnapshot!: string
    @readonly @field('assigned_boundary_revision') assignedBoundaryRevision!: number
    @readonly @field('submission_id') submissionId!: string
    @readonly @field('request_json') requestJson!: string

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
