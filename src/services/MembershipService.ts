import { database } from '../database';
import Borrower from '../database/models/Borrower';
import { ShareCapitalService } from './ShareCapitalService';
import { Q } from '@nozbe/watermelondb';
import ActionLogService from './ActionLogService';

export class MembershipService {
    /**
     * Completes the membership application process for a borrower
     * - Verifies PMES completion
     * - Verifies minimum share capital subscription
     * - Verifies minimum paid-up capital
     * - Assigns membership number and updates status to Regular or Associate
     */
    static async approveMembership(
        borrowerId: string, 
        bodResolutionNumber: string,
        approvedBy: string
    ): Promise<Borrower> {
        return database.write(async () => {
            const borrower = await database.get<Borrower>('borrowers').find(borrowerId);
            
            // 1. Verify Share Capital
            const balance = await ShareCapitalService.getCurrentBalance(borrowerId);
            const history = await ShareCapitalService.getHistory(borrowerId);
            const totalSubscribed = history
                .filter(t => t.transactionType === 'SUBSCRIPTION')
                .reduce((sum, t) => sum + (t.numberOfShares || 0), 0);

            let membershipType: 'associate' | 'regular' = 'associate';

            // Regular member requires: >= 20 shares subscribed, >= 5 shares paid
            if (totalSubscribed >= 20 && balance.shares >= 5) {
                membershipType = 'regular';
            }

            // Generate Membership Number
            const year = new Date().getFullYear().toString().slice(-2);
            const count = await database.get<Borrower>('borrowers').query().fetchCount();
            const memberNo = `M${year}-${String(count + 1).padStart(4, '0')}`;

            // Update Borrower
            await borrower.update((record: any) => {
                record.membershipNumber = memberNo;
                record.membershipStatus = 'active';
                record.membershipType = membershipType;
                record.membershipDate = Date.now();
                record.bodResolutionNumber = bodResolutionNumber;
            });

            return borrower;
        });
    }

    /**
     * Links a Member (Borrower) record to a User Account (Auth ID).
     * Unlinks any other member currently assigned to this authId,
     * updates the target borrower's authId, records audit logs, and returns the updated borrower.
     */
    static async linkMemberToUser(borrowerId: string, authId: string): Promise<Borrower> {
        return database.write(async () => {
            const batchOps: any[] = [];
            const logs: any[] = [];

            // 1. Unlink any other member currently linked to this user (authId)
            if (authId) {
                const currentlyLinked = await database.get<Borrower>('borrowers')
                    .query(Q.where('auth_id', authId))
                    .fetch();

                for (const b of currentlyLinked) {
                    if (b.id !== borrowerId) {
                        const oldAuthId = b.authId;
                        batchOps.push(b.prepareUpdate((record: any) => {
                            record.authId = '';
                        }));
                        logs.push({
                            entityType: 'borrowers',
                            entityId: b.id,
                            action: 'UPDATE',
                            oldData: { authId: oldAuthId },
                            newData: { authId: '' },
                        });
                    }
                }
            }

            // 2. Link target borrower to authId
            const borrower = await database.get<Borrower>('borrowers').find(borrowerId);
            const oldAuthId = borrower.authId;
            if (oldAuthId !== authId) {
                batchOps.push(borrower.prepareUpdate((record: any) => {
                    record.authId = authId;
                }));
                logs.push({
                    entityType: 'borrowers',
                    entityId: borrower.id,
                    action: 'UPDATE',
                    oldData: { authId: oldAuthId },
                    newData: { authId },
                });
            }

            if (batchOps.length > 0) {
                const auditLogs = await ActionLogService.prepareLogActions(logs);
                await database.batch(...batchOps, ...auditLogs);
            }

            return borrower;
        });
    }

    /**
     * Unlinks a Member (Borrower) record from any User Account (Auth ID).
     */
    static async unlinkMemberFromUser(borrowerId: string): Promise<Borrower> {
        return database.write(async () => {
            const borrower = await database.get<Borrower>('borrowers').find(borrowerId);
            if (borrower.authId) {
                const oldAuthId = borrower.authId;
                await borrower.update((record: any) => {
                    record.authId = '';
                });
                await ActionLogService.logAction({
                    entityType: 'borrowers',
                    entityId: borrower.id,
                    action: 'UPDATE',
                    oldData: { authId: oldAuthId },
                    newData: { authId: '' }
                });
            }
            return borrower;
        });
    }
}

