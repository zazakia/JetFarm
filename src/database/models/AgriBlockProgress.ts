import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'
import { BlockAssignmentStatus } from './AgriBlockAssignment'

export default class AgriBlockProgress extends Model {
    static table = 'agri_block_progress'

    @readonly @field('assignment_id') assignmentId!: string
    @readonly @date('update_date') updateDate!: Date
    @readonly @field('progress_percent') progressPercent!: number
    @readonly @field('status') status!: BlockAssignmentStatus
    @readonly @field('notes') notes!: string | null
    @readonly @field('recorded_by') recordedBy!: string
    @readonly @field('submission_id') submissionId!: string
    @readonly @field('correction_of_id') correctionOfId!: string | null
    @readonly @field('request_json') requestJson!: string

    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date
}
