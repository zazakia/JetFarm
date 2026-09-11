import { PayrollServiceClass } from '../PayrollService';
import { Database } from '@nozbe/watermelondb';

jest.mock('../../database', () => {
    const { createTestDatabase } = jest.requireActual('../../__tests__/test-utils');
    const db = createTestDatabase();
    return { database: db };
});

describe('PayrollService', () => {
    let service: PayrollServiceClass;
    let database: Database;

    beforeEach(async () => {
        const dbModule = require('../../database');
        database = dbModule.database;
        service = new PayrollServiceClass();
        
        // Reset the test database to ensure test isolation
        await database.write(async () => {
            await database.unsafeResetDatabase();
        });
        
        jest.clearAllMocks();
    });

    describe('Employees Management', () => {
        it('creates, fetches, and updates an employee', async () => {
            const employee = await service.createEmployee({
                name: 'Juan Dela Cruz',
                role: 'Collector',
                baseSalary: 15000,
            });

            expect(employee).toBeDefined();
            expect(employee.name).toBe('Juan Dela Cruz');
            expect(employee.role).toBe('Collector');
            expect(employee.baseSalary).toBe(15000);
            expect(employee.isActive).toBe(true);

            // Fetch employees
            const employees = await service.getEmployees();
            expect(employees.length).toBe(1);
            const found = employees.find(e => e.id === employee.id);
            expect(found).toBeDefined();

            // Update employee
            const updated = await service.updateEmployee(employee, {
                name: 'Juan D. Cruz',
                baseSalary: 16000,
                isActive: false,
            });
            expect(updated.name).toBe('Juan D. Cruz');
            expect(updated.baseSalary).toBe(16000);
            expect(updated.isActive).toBe(false);
        });
    });

    describe('Payroll Processing (Runs & Lines)', () => {
        it('creates payroll run with lines, fetches runs and lines, and approves run', async () => {
            // Setup active employees
            const employee = await service.createEmployee({
                name: 'Maria Santos',
                role: 'Loan Encoder',
                baseSalary: 18000,
                dailyRate: 600,
                branchId: 'branch-1',
            });

            const start = new Date(2026, 4, 1); // May 1
            const end = new Date(2026, 4, 15); // May 15

            // Create payroll run
            const run = await service.createPayrollRun({
                branchId: 'branch-1',
                periodStart: start,
                periodEnd: end,
                computedBy: 'admin-user',
            });

            expect(run).toBeDefined();
            expect(run.branchId).toBe('branch-1');
            expect(run.status).toBe('draft');
            expect(run.totalGross).toBeGreaterThan(0);
            expect(run.totalNet).toBe(run.totalGross);

            // Re-calling with same params returns existing run
            const duplicateRun = await service.createPayrollRun({
                branchId: 'branch-1',
                periodStart: start,
                periodEnd: end,
            });
            expect(duplicateRun.id).toBe(run.id);

            // Fetch runs
            const runs = await service.getPayrollRuns('branch-1');
            expect(runs.length).toBe(1);
            expect(runs[0].id).toBe(run.id);

            const allRuns = await service.getPayrollRuns();
            expect(allRuns.length).toBe(1);

            // Fetch lines
            const lines = await service.getPayrollLines(run.id);
            expect(lines.length).toBe(1);
            expect(lines[0].employeeId).toBe(employee.id);
            expect(lines[0].basicPay).toBeGreaterThan(0);
            expect(lines[0].grossPay).toBe(lines[0].basicPay);
            expect(lines[0].netPay).toBe(lines[0].grossPay);

            // Approve run
            const approved = await service.approveRun(run.id, 'admin-supervisor');
            expect(approved.status).toBe('approved');
            expect(approved.approvedBy).toBe('admin-supervisor');
            expect(approved.approvedAt).toBeDefined();
        });

        it('throws error when approving non-existent run', async () => {
            await expect(service.approveRun('non-existent-id', 'admin')).rejects.toThrow();
        });
    });
});
