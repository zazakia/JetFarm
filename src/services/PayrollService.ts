import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Employee from '../database/models/Employee';
import PayrollRun from '../database/models/PayrollRun';
import PayrollLine from '../database/models/PayrollLine';
import { BaseModelServiceClass } from './BaseModelService';
import { ErrorService, ErrorType } from './ErrorService';
import { supabase } from '../database/supabase';

export class PayrollServiceClass extends BaseModelServiceClass {
    constructor() {
        super();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EMPLOYEE CRUD
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fetch all active employees (not soft-deleted).
     */
    async getEmployees(): Promise<Employee[]> {
        try {
            return await this.db.get<Employee>('employees')
                .query(Q.where('deleted_at', null), Q.where('is_active', true))
                .fetch();
        } catch (error) {
            throw ErrorService.handleError(error, 'PayrollService.getEmployees', ErrorType.DATABASE);
        }
    }

    /**
     * Create an employee record. Supports both new detailed fields and legacy fields.
     */
    async createEmployee(data: {
        employeeCode?: string;
        firstName?: string;
        lastName?: string;
        middleName?: string;
        position?: string;
        branchId?: string;
        dailyRate?: number;
        sssNumber?: string;
        philhealthNumber?: string;
        pagibigNumber?: string;
        tin?: string;
        phone?: string;
        // Legacy fields:
        name?: string;
        role?: string;
        baseSalary?: number;
    }): Promise<Employee> {
        let firstName = data.firstName;
        let lastName = data.lastName;
        if (!firstName && data.name) {
            const parts = data.name.trim().split(' ');
            firstName = parts[0] || 'Staff';
            lastName = parts.slice(1).join(' ') || 'Member';
        }

        const baseSalary = data.baseSalary ?? (data.dailyRate ? data.dailyRate * 26 : undefined);
        const dailyRate = data.dailyRate ?? (data.baseSalary ? Math.round((data.baseSalary / 26) * 100) / 100 : 0);
        const position = data.position ?? data.role ?? 'crew';
        const employeeCode = data.employeeCode ?? `EMP-${Date.now().toString().slice(-6)}`;

        return this.db.write(async () => {
            return await this.db.get<Employee>('employees').create((record: any) => {
                record.employeeCode = employeeCode;
                record.firstName = firstName ?? 'Staff';
                record.lastName = lastName ?? 'Member';
                record.middleName = data.middleName ?? null;
                record.position = position;
                record.roleField = position;
                record.branchId = data.branchId ?? null;
                record.dailyRate = dailyRate;
                record.baseSalaryField = baseSalary ?? null;
                record.sssNumber = data.sssNumber ?? null;
                record.philhealthNumber = data.philhealthNumber ?? null;
                record.pagibigNumber = data.pagibigNumber ?? null;
                record.tin = data.tin ?? null;
                record.phone = data.phone ?? null;
                record.isActive = true;
                const fullName = `${record.firstName} ${record.lastName}`.trim();
                record._raw.name = fullName;
            });
        });
    }

    /**
     * Update an employee record. Supports both new detailed fields and legacy fields.
     */
    async updateEmployee(
        employee: Employee,
        data: Partial<{
            firstName: string;
            lastName: string;
            position: string;
            dailyRate: number;
            isActive: boolean;
            branchId: string;
            // Legacy fields:
            name: string;
            role: string;
            baseSalary: number;
        }>
    ): Promise<Employee> {
        return this.db.write(async () => {
            await employee.update((record: any) => {
                if (data.name !== undefined) {
                    const parts = data.name.trim().split(' ');
                    record.firstName = parts[0] || '';
                    record.lastName = parts.slice(1).join(' ') || '';
                }
                if (data.firstName !== undefined) record.firstName = data.firstName;
                if (data.lastName !== undefined) record.lastName = data.lastName;
                if (data.role !== undefined) {
                    record.position = data.role;
                    record.roleField = data.role;
                }
                if (data.position !== undefined) {
                    record.position = data.position;
                    record.roleField = data.position;
                }
                if (data.baseSalary !== undefined) {
                    record.baseSalaryField = data.baseSalary;
                    record.dailyRate = Math.round((data.baseSalary / 26) * 100) / 100;
                }
                if (data.dailyRate !== undefined) {
                    record.dailyRate = data.dailyRate;
                    if (data.baseSalary === undefined) {
                        record.baseSalaryField = data.dailyRate * 26;
                    }
                }
                if (data.isActive !== undefined) record.isActive = data.isActive;
                if (data.branchId !== undefined) record.branchId = data.branchId;
            });
            return employee;
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PAYROLL RUN CRUD (new schema)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get all payroll runs, optionally filtered to a specific branch.
     */
    async getPayrollRuns(branchId?: string): Promise<PayrollRun[]> {
        try {
            const queries: any[] = [Q.where('deleted_at', null)];
            if (branchId) queries.push(Q.where('branch_id', branchId));
            return await this.db.get<PayrollRun>('payroll_runs')
                .query(...queries)
                .fetch();
        } catch (error) {
            throw ErrorService.handleError(error, 'PayrollService.getPayrollRuns', ErrorType.DATABASE);
        }
    }

    /**
     * Get all payroll lines for a specific run.
     */
    async getPayrollLines(payrollRunId: string): Promise<PayrollLine[]> {
        try {
            return await this.db.get<PayrollLine>('payroll_lines')
                .query(Q.where('payroll_id', payrollRunId), Q.where('deleted_at', null))
                .fetch();
        } catch (error) {
            throw ErrorService.handleError(error, 'PayrollService.getPayrollLines', ErrorType.DATABASE);
        }
    }

    /**
     * Create a new draft payroll run for a branch + period.
     * Auto-generates a payroll line per active employee.
     */
    async createPayrollRun(opts: {
        branchId: string;
        periodStart: Date;
        periodEnd: Date;
        computedBy?: string;
    }): Promise<PayrollRun> {
        const employees = await this.getEmployees();
        const branchEmployees = employees.filter(
            e => !opts.branchId || e.branchId === opts.branchId
        );

        return this.db.write(async () => {
            // Check if a run already exists for this branch + period
            const existing = await this.db.get<PayrollRun>('payroll_runs')
                .query(
                    Q.where('branch_id', opts.branchId),
                    Q.where('period_start', opts.periodStart.getTime()),
                    Q.where('period_end', opts.periodEnd.getTime()),
                    Q.where('deleted_at', null)
                ).fetch();

            if (existing.length > 0) {
                return existing[0];
            }

            // Calculate totals
            let totalGross = 0;
            const days = Math.ceil(
                (opts.periodEnd.getTime() - opts.periodStart.getTime()) / (1000 * 60 * 60 * 24)
            );

            const lineData = branchEmployees.map(emp => {
                const basicPay = emp.dailyRate * days;
                totalGross += basicPay;
                return { emp, basicPay };
            });

            // Create the run header
            const run = await this.db.get<PayrollRun>('payroll_runs').create((r: any) => {
                r.branchId = opts.branchId;
                r.periodStart = opts.periodStart.getTime();
                r.periodEnd = opts.periodEnd.getTime();
                r.status = 'draft';
                r.totalGross = totalGross;
                r.totalDeductions = 0;
                r.totalNet = totalGross;
                r.totalEmployerContributions = 0;
                r.computedBy = opts.computedBy ?? null;
            });

            // Create per-employee lines
            for (const { emp, basicPay } of lineData) {
                await this.db.get<PayrollLine>('payroll_lines').create((l: any) => {
                    l.payrollId = run.id;
                    l.employeeId = emp.id;
                    l.daysWorked = days;
                    l.basicPay = basicPay;
                    l.overtimeHours = 0;
                    l.overtimePay = 0;
                    l.holidayPay = 0;
                    l.tlAllowance = 0;
                    l.thirteenthMonth = 0;
                    l.otherEarnings = 0;
                    l.grossPay = basicPay;
                    l.sssEe = 0;
                    l.philhealthEe = 0;
                    l.pagibigEe = 0;
                    l.withholdingTax = 0;
                    l.otherDeductions = 0;
                    l.totalDeductions = 0;
                    l.netPay = basicPay;
                    l.sssEr = 0;
                    l.philhealthEr = 0;
                    l.pagibigEr = 0;
                });
            }

            return run;
        });
    }

    /**
     * Approve a payroll run (draft → approved).
     */
    async approveRun(runId: string, approvedBy: string): Promise<PayrollRun> {
        return this.db.write(async () => {
            const run = await this.db.get<PayrollRun>('payroll_runs').find(runId);
            if (!run) throw new Error('Payroll run not found');
            await run.update((r: any) => {
                r.status = 'approved';
                r.approvedBy = approvedBy;
                r.approvedAt = Date.now();
            });
            return run;
        });
    }

    /**
     * Post a payroll run (approved → posted).
     * The DB trigger auto_post_payroll_journal fires and creates the journal entry.
     */
    async postRun(runId: string): Promise<void> {
        const { error } = await supabase
            .from('payroll_runs')
            .update({ status: 'posted', updated_at: new Date().toISOString() })
            .eq('id', runId);

        if (error) throw ErrorService.handleError(error, `Failed to post payroll run: ${error.message}`);
    }
}

export const PayrollService = new PayrollServiceClass();
export default PayrollService;
