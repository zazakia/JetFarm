import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

/**
 * Employee model — matches Supabase `employees` table (v45 schema)
 * Covers PH statutory IDs (SSS, PhilHealth, Pag-IBIG, TIN) + HR fields.
 */
export default class Employee extends Model {
    static table = 'employees'

    @field('employee_code') employeeCode!: string
    @field('first_name') firstName!: string
    @field('last_name') lastName!: string
    @field('middle_name') middleName!: string | null

    /** crew | team_leader | supervisor | manager */
    @field('position') position!: string
    @field('branch_id') branchId!: string | null
    @field('daily_rate') dailyRate!: number
    @field('base_salary') baseSalaryField!: number | null
    @field('role') roleField!: string | null

    @date('hire_date') hireDate!: Date | null

    // Government IDs (201 File)
    @field('sss_number') sssNumber!: string | null
    @field('philhealth_number') philhealthNumber!: string | null
    @field('pagibig_number') pagibigNumber!: string | null
    @field('tin') tin!: string | null

    // Contact info
    @field('phone') phone!: string | null
    @field('emergency_contact') emergencyContact!: string | null
    @field('emergency_phone') emergencyPhone!: string | null

    // Status
    @field('is_active') isActive!: boolean
    @date('separation_date') separationDate!: Date | null
    @field('separation_reason') separationReason!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null

    /** Convenience: full display name */
    get fullName(): string {
        if (this.firstName || this.lastName) {
            const middle = this.middleName ? ` ${this.middleName.charAt(0)}.` : ''
            return `${this.firstName || ''}${middle} ${this.lastName || ''}`.trim()
        }
        return (this as any)._raw?.name || ''
    }

    /** Backwards-compatible legacy accessors */
    get name(): string {
        return this.fullName || (this as any)._raw?.name || ''
    }

    get role(): string {
        return this.position || (this as any)._raw?.role || 'crew'
    }

    get baseSalary(): number {
        if (this.baseSalaryField != null && this.baseSalaryField > 0) {
            return this.baseSalaryField
        }
        if (this.dailyRate) {
            return Math.round(this.dailyRate * 26)
        }
        return (this as any)._raw?.base_salary || 0
    }
}
