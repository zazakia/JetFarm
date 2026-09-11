import { Model } from '@nozbe/watermelondb'
import { field, date, relation } from '@nozbe/watermelondb/decorators'

export default class Payroll extends Model {
    static table = 'payrolls'

    @relation('employees', 'employee_id') employee: any;
    @field('employee_id') employeeId: string;
    @date('period_start') periodStart: number;
    @date('period_end') periodEnd: number;
    @field('base_salary') baseSalary: number;
    @field('deductions') deductions: number;
    @field('allowances') allowances: number;
    @field('net_pay') netPay: number;
    @field('status') status: string; // 'draft', 'finalized', 'paid'
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
