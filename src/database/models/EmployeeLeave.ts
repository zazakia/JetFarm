import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class EmployeeLeave extends Model {
    static table = 'employee_leaves'

    @field('employee_id') employeeId!: string
    /** vacation | sick | emergency | maternity | paternity | unpaid */
    @field('leave_type') leaveType!: string
    @date('start_date') startDate!: Date
    @date('end_date') endDate!: Date
    @field('days_count') daysCount!: number
    @field('reason') reason!: string | null
    /** pending | approved | rejected | cancelled */
    @field('status') status!: string
    @field('approved_by') approvedBy!: string | null
    @date('approved_at') approvedAt!: Date | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
