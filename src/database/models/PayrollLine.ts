import { Model } from '@nozbe/watermelondb'
import { field, date, relation } from '@nozbe/watermelondb/decorators'

export default class PayrollLine extends Model {
    static table = 'payroll_lines'

    @relation('payroll_runs', 'payroll_id') payroll!: any
    @field('payroll_id') payrollId!: string
    @field('employee_id') employeeId!: string

    @field('days_worked') daysWorked!: number
    @field('basic_pay') basicPay!: number
    @field('overtime_hours') overtimeHours!: number
    @field('overtime_pay') overtimePay!: number
    @field('holiday_pay') holidayPay!: number
    @field('tl_allowance') tlAllowance!: number
    @field('thirteenth_month') thirteenthMonth!: number
    @field('other_earnings') otherEarnings!: number
    @field('gross_pay') grossPay!: number

    @field('sss_ee') sssEe!: number
    @field('philhealth_ee') philhealthEe!: number
    @field('pagibig_ee') pagibigEe!: number
    @field('withholding_tax') withholdingTax!: number
    @field('other_deductions') otherDeductions!: number
    @field('total_deductions') totalDeductions!: number
    @field('net_pay') netPay!: number

    @field('sss_er') sssEr!: number
    @field('philhealth_er') philhealthEr!: number
    @field('pagibig_er') pagibigEr!: number

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
