import { LoanApplicationService } from '../LoanApplicationService';
import { createTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

jest.mock('../../database', () => {
    const { createTestDatabase } = jest.requireActual('../../__tests__/test-utils');
    const db = createTestDatabase();
    return { database: db };
});

describe('LoanApplicationService', () => {
    let service: LoanApplicationService;
    let database: Database;

    beforeEach(async () => {
        const dbModule = require('../../database');
        database = dbModule.database;
        // In case the DB instance persists between tests unexpectedly, clear it or recreate
        service = new LoanApplicationService();
        jest.clearAllMocks();
    });

    describe('createApplication', () => {
        it('creates a new loan application under review', async () => {
            const app = await service.createApplication({
                borrowerId: 'b-1',
                amountApplied: 5000,
                purpose: 'Business',
            });

            expect(app).toBeDefined();
            expect(app.borrowerId).toBe('b-1');
            expect(app.amountApplied).toBe(5000);
            expect(app.purpose).toBe('Business');
            expect(app.status).toBe('under_review');
        });

        it('saves guarantors when provided', async () => {
            const app = await service.createApplication({
                borrowerId: 'b-2',
                amountApplied: 10000,
                guarantors: [
                    { guarantorName: 'John Doe', contactNo: '12345' },
                    { guarantorName: 'Jane Smith' }
                ]
            });

            const guarantors = await database.get('guarantors').query().fetch() as any[];
            expect(guarantors.length).toBe(2);
            expect(guarantors[0].applicationId).toBe(app.id);
            expect(guarantors[0].guarantorName).toBe('John Doe');
            expect(guarantors[0].contactNo).toBe('12345');
            expect(guarantors[1].guarantorName).toBe('Jane Smith');
        });
    });

    describe('getApplicationsByStatus', () => {
        it('fetches applications filtering by status', async () => {
            await service.createApplication({ borrowerId: 'b-3', amountApplied: 2000 });
            const apps = await service.getApplicationsByStatus('under_review');
            expect(apps.length).toBeGreaterThan(0);
            expect(apps[0].status).toBe('under_review');
        });
    });

    describe('approveApplication', () => {
        it('updates status and approver information', async () => {
            const app = await service.createApplication({ borrowerId: 'b-4', amountApplied: 3000 });
            const approvedApp = await service.approveApplication(app.id, 'admin-1', 2500);

            expect(approvedApp.status).toBe('approved');
            expect(approvedApp.approvedBy).toBe('admin-1');
            expect(approvedApp.amountApproved).toBe(2500);
            expect(approvedApp.approvedAt).toBeTruthy();
        });

        it('throws if application not found', async () => {
            await expect(service.approveApplication('missing', 'admin', 100)).rejects.toThrow();
        });
    });

    describe('rejectApplication', () => {
        it('updates status to rejected and appends notes', async () => {
            const app = await service.createApplication({ borrowerId: 'b-5', amountApplied: 4000, notes: 'Initial note' });
            const rejectedApp = await service.rejectApplication(app.id, 'Not enough capacity');

            expect(rejectedApp.status).toBe('rejected');
            expect(rejectedApp.notes).toContain('Initial note');
            expect(rejectedApp.notes).toContain('Rejected: Not enough capacity');
        });
    });
});
