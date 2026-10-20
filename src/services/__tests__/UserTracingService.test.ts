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
                    l.entityType = 'journal_entries';
                    l.entityId = 'je-001';
                    l.action = 'CREATE';
                    l.performedBy = 'user-admin-1';
                    l.oldData = '';
                    l.newData = JSON.stringify({ reference_number: 'JE-2026-001', total_debit: 15000 });
                    l.timestamp = Date.now();
                });
                await logsColl.create((l: any) => {
                    l.entityType = 'expenses';
                    l.entityId = 'exp-001';
                    l.action = 'CREATE';
                    l.performedBy = 'user-admin-1';
                    l.oldData = '';
                    l.newData = JSON.stringify({ amount: 1500, description: 'Hauling' });
                    l.timestamp = Date.now() + 1000;
                });
            });

            const timeline = await service.getUserActivityTimeline('user-admin-1');
            expect(timeline.length).toBe(2);
            expect(timeline[0].entityType).toBe('expenses');
            expect(timeline[0].action).toBe('CREATE');
            expect(timeline[0].narrative).toBeDefined();
            expect(timeline[1].entityType).toBe('journal_entries');
        });
    });

    describe('getUserDataRelationships', () => {
        it('returns null if user profile does not exist', async () => {
            const result = await service.getUserDataRelationships('non-existent-user');
            expect(result).toBeNull();
        });

        it('correctly aggregates data relationships, counts, and organization info', async () => {
            // Seed user profile, business unit, action log, and journal entry
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

                const journalColl = database.get('journal_entries');
                await journalColl.create((je: any) => {
                    je.referenceNumber = 'JE-9999';
                    je.description = 'Parcel input purchase';
                    je.entryType = 'manual';
                    je.postedBy = 'user-officer-99';
                    je.isPosted = true;
                    je.totalDebit = 25000;
                    je.totalCredit = 25000;
                    je.entryDate = new Date();
                });
            });

            const rel = await service.getUserDataRelationships('user-officer-99');
            expect(rel).toBeDefined();
            expect(rel?.user.fullName).toBe('Maria Santos');
            expect(rel?.organization.branchName).toBe('Bagacay Benchmark Branch');
            expect(rel?.counts.actionsLogged).toBe(1);
            expect(rel?.counts.journalEntriesPosted).toBe(1);
            expect(rel?.totals.journalEntriesVolume).toBe(25000);
            expect(rel?.recentRelatedEntities.length).toBeGreaterThanOrEqual(1);
        });
    });
});
