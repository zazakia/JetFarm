import { UserTracingServiceClass } from '../UserTracingService';
import { createTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('UserTracingService', () => {
    let database: Database;
    let service: UserTracingServiceClass;

    beforeEach(async () => {
        database = createTestDatabase();
        service = new UserTracingServiceClass(database);
        jest.clearAllMocks();
    });

    describe('getUserActivityTimeline', () => {
        it('returns empty array when no activity exists for user', async () => {
            const timeline = await service.getUserActivityTimeline('unknown-user');
            expect(timeline).toEqual([]);
        });

        it('returns formatted timeline events when action logs exist', async () => {
            await database.write(async () => {
                const logsColl = database.get('action_logs');
                await logsColl.create((l: any) => {
                    l.entityType = 'loans';
                    l.entityId = 'loan-001';
                    l.action = 'CREATE';
                    l.performedBy = 'user-admin-1';
                    l.oldData = '';
                    l.newData = JSON.stringify({ loan_number: 'LN-2026-001', principal_amount: 15000 });
                    l.timestamp = Date.now();
                });
                await logsColl.create((l: any) => {
                    l.entityType = 'payments';
                    l.entityId = 'pay-001';
                    l.action = 'CREATE';
                    l.performedBy = 'user-admin-1';
                    l.oldData = '';
                    l.newData = JSON.stringify({ amount: 1500, receipt_number: 'OR-8888' });
                    l.timestamp = Date.now() + 1000;
                });
            });

            const timeline = await service.getUserActivityTimeline('user-admin-1');
            expect(timeline.length).toBe(2);
            expect(timeline[0].entityType).toBe('payments');
            expect(timeline[0].action).toBe('CREATE');
            expect(timeline[0].narrative).toBeDefined();
            expect(timeline[1].entityType).toBe('loans');
        });
    });

    describe('getUserDataRelationships', () => {
        it('returns null if user profile does not exist', async () => {
            const result = await service.getUserDataRelationships('non-existent-user');
            expect(result).toBeNull();
        });

        it('correctly aggregates data relationships, counts, and organization info', async () => {
            // Seed user profile, business unit, action log, and loan
            await database.write(async () => {
                const buColl = database.get('business_units');
                await buColl.create((b: any) => {
                    b._raw.id = 'branch-bagacay';
                    b.name = 'Bagacay Benchmark Branch';
                    b.code = 'BAG';
                    b.type = 'branch';
                    b.isActive = true;
                });

                const userColl = database.get('user_profiles');
                await userColl.create((u: any) => {
                    u._raw.id = 'user-officer-99';
                    u.fullName = 'Maria Santos';
                    u.email = 'maria.santos@poscursor.com';
                    u.role = 'admin';
                    u.isActive = true;
                    u.branchId = 'branch-bagacay';
                });

                const logsColl = database.get('action_logs');
                await logsColl.create((l: any) => {
                    l.entityType = 'user_profiles';
                    l.entityId = 'user-officer-99';
                    l.action = 'CREATE';
                    l.performedBy = 'user-officer-99';
                    l.timestamp = Date.now();
                });

                const loansColl = database.get('loans');
                await loansColl.create((loan: any) => {
                    loan.borrowerId = 'borrower-1';
                    loan.approvedBy = 'user-officer-99';
                    loan.principalAmount = 25000;
                    loan.totalAmount = 27500;
                    loan.loanNumber = 'LN-9999';
                });
            });

            const rel = await service.getUserDataRelationships('user-officer-99');
            expect(rel).toBeDefined();
            expect(rel?.user.fullName).toBe('Maria Santos');
            expect(rel?.organization.branchName).toBe('Bagacay Benchmark Branch');
            expect(rel?.counts.actionsLogged).toBe(1);
            expect(rel?.counts.loansApproved).toBe(1);
            expect(rel?.totals.loansVolume).toBe(25000);
            expect(rel?.recentRelatedEntities.length).toBeGreaterThanOrEqual(1);
        });
    });
});
