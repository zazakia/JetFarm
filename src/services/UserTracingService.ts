import { database as globalDatabase } from '../database';
import { Database, Q } from '@nozbe/watermelondb';
import ActionLog from '../database/models/ActionLog';
import UserProfile from '../database/models/UserProfile';
import Borrower from '../database/models/Borrower';
import Loan from '../database/models/Loan';
import Payment from '../database/models/Payment';
import Remittance from '../database/models/Remittance';
import JournalEntry from '../database/models/JournalEntry';
import StockMovement from '../database/models/StockMovement';
import SalesReturn from '../database/models/SalesReturn';
import BusinessUnit from '../database/models/BusinessUnit';
import Area from '../database/models/Area';
import {
    resolveOperator,
    formatEntityInfo,
    generateActionNarrative,
    formatFieldChanges,
    OperatorInfo,
    EntityInfo,
    FieldChange,
} from '../utils/auditTrailFormatter';
import { formatDateTime, formatRelative } from '../utils/dates';
import { ROLE_LABELS } from '../constants/roles';

export interface UserActivityEvent {
    id: string;
    timestamp: number;
    formattedDate: string;
    relativeTime: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
    entityType: string;
    entityId: string;
    entityName: string;
    module: string;
    icon: string;
    badgeColor: string;
    title: string;
    subtitle?: string;
    narrative: string;
    changes: FieldChange[];
    oldDataRaw?: string;
    newDataRaw?: string;
    performedBy: string;
    operator: OperatorInfo;
}

export interface UserRelationshipNode {
    id: string;
    type: 'branch' | 'area' | 'borrower' | 'loan' | 'payment' | 'remittance' | 'journal_entry' | 'stock_movement' | 'sales_return';
    title: string;
    subtitle?: string;
    badge?: string;
    date?: number;
    amount?: number;
    roleInRelation: 'assigned' | 'linked' | 'approved' | 'collected' | 'posted' | 'created' | 'performed';
    linkRoute?: string;
}

export interface UserDataRelationships {
    user: {
        id: string;
        fullName: string;
        email: string;
        role: string;
        roleLabel: string;
        isActive: boolean;
        branchId?: string;
        areaId?: string;
        createdAt?: number;
    };
    organization: {
        branchId?: string;
        branchName?: string;
        areaId?: string;
        areaName?: string;
    };
    linkedBorrower?: {
        id: string;
        fullName: string;
        memberId?: string;
        contactNumber?: string;
        address?: string;
    } | null;
    counts: {
        actionsLogged: number;
        loansApproved: number;
        loansManaged: number;
        paymentsCollected: number;
        remittancesHandled: number;
        journalEntriesPosted: number;
        stockMovements: number;
        salesReturns: number;
    };
    totals: {
        loansVolume: number;
        paymentsVolume: number;
        journalEntriesVolume: number;
    };
    recentRelatedEntities: UserRelationshipNode[];
    activityByModule: Record<string, number>;
    activityByAction: Record<string, number>;
    firstActiveAt?: number;
    lastActiveAt?: number;
}

export class UserTracingServiceClass {
    private _db?: Database;

    constructor(db?: Database) {
        this._db = db;
    }

    private get db(): Database {
        return this._db || globalDatabase;
    }

    /**
     * Resolves user identifiers (UUID, email, username) to match any potential identifier used in logs.
     */
    private buildUserAliases(user: UserProfile | { id: string; email?: string; fullName?: string }): string[] {
        const aliases = new Set<string>();
        if (user.id) aliases.add(user.id);
        if (user.email) {
            aliases.add(user.email);
            aliases.add(user.email.toLowerCase());
            // Extract username part if applicable (e.g. "admin" from "admin@poscursor.com")
            const atIndex = user.email.indexOf('@');
            if (atIndex > 0) {
                aliases.add(user.email.substring(0, atIndex));
            }
        }
        if (user.fullName) {
            aliases.add(user.fullName);
        }
        return Array.from(aliases);
    }

    /**
     * Retrieves the chronological activity timeline for a user across all system modules.
     */
    async getUserActivityTimeline(userId: string, limit: number = 100): Promise<UserActivityEvent[]> {
        const db = this.db;
        if (!db) return [];

        try {
            // Find user profile to get aliases
            let userAliases = [userId];
            try {
                const user = await db.get<UserProfile>('user_profiles').find(userId);
                if (user) {
                    userAliases = this.buildUserAliases(user);
                }
            } catch {
                // If not found by primary id, proceed with input string
            }

            // Build query on action_logs
            const logsCollection = db.get<ActionLog>('action_logs');
            if (!logsCollection) return [];

            const logs = await logsCollection
                .query(
                    Q.where('performed_by', Q.oneOf(userAliases)),
                    Q.sortBy('timestamp', Q.desc),
                    Q.take(limit)
                )
                .fetch();

            // Load profiles map for operator name resolution
            const userProfiles = await db.get<UserProfile>('user_profiles').query().fetch().catch(() => []);
            const userMap = new Map<string, { id: string; fullName: string; role: string; email?: string }>();
            for (const p of userProfiles) {
                userMap.set(p.id, {
                    id: p.id,
                    fullName: p.fullName || p.email,
                    role: p.role,
                    email: p.email,
                });
            }

            return logs.map((log) => {
                const operator = resolveOperator(log.performedBy, userMap);
                const entityInfo = formatEntityInfo(log.entityType, log.entityId, log.oldData, log.newData);
                const changes = formatFieldChanges(log.oldData, log.newData);
                const narrative = generateActionNarrative(log.action, log.entityType, log.entityId, log.oldData, log.newData);

                return {
                    id: log.id,
                    timestamp: log.timestamp || (log.createdAt ? Number(log.createdAt) : Date.now()),
                    formattedDate: formatDateTime(log.timestamp || log.createdAt),
                    relativeTime: formatRelative(log.timestamp || log.createdAt),
                    action: log.action,
                    entityType: log.entityType,
                    entityId: log.entityId,
                    entityName: entityInfo.entityName,
                    module: entityInfo.module,
                    icon: entityInfo.icon,
                    badgeColor: entityInfo.badgeColor,
                    title: entityInfo.title,
                    subtitle: entityInfo.subtitle,
                    narrative,
                    changes,
                    oldDataRaw: log.oldData,
                    newDataRaw: log.newData,
                    performedBy: log.performedBy,
                    operator,
                };
            });
        } catch (error) {
            console.error('[UserTracingService] Error fetching user activity timeline:', error);
            return [];
        }
    }

    /**
     * Builds comprehensive data relationships showing all entities linked to a specific user.
     */
    async getUserDataRelationships(userId: string): Promise<UserDataRelationships | null> {
        const db = this.db;
        if (!db) return null;

        try {
            // 1. Fetch User Profile
            const user = await db.get<UserProfile>('user_profiles').find(userId).catch(() => null);
            if (!user) return null;

            const userAliases = this.buildUserAliases(user);

            // 2. Resolve Branch and Area
            let branchName = '';
            let areaName = '';
            if (user.branchId) {
                try {
                    const bu = await db.get<BusinessUnit>('business_units').find(user.branchId);
                    if (bu) branchName = bu.name;
                } catch {
                    // Fallback to known branches
                    branchName = user.branchId;
                }
            }
            if (user.areaId) {
                try {
                    const area = await db.get<Area>('areas').find(user.areaId);
                    if (area) areaName = area.name;
                } catch {
                    areaName = user.areaId;
                }
            }

            // 3. Resolve Linked Borrower Profile
            let linkedBorrower: UserDataRelationships['linkedBorrower'] = null;
            try {
                const borrowersColl = db.get<Borrower>('borrowers');
                if (borrowersColl) {
                    const linked = await borrowersColl.query(
                        Q.or(
                            Q.where('auth_id', userId),
                            Q.where('id', userId)
                        )
                    ).fetch();
                    if (linked.length > 0) {
                        const b = linked[0];
                        linkedBorrower = {
                            id: b.id,
                            fullName: b.fullName,
                            memberId: b.memberId || undefined,
                            contactNumber: b.phone || b.contactNo || undefined,
                            address: b.address || undefined,
                        };
                    }
                }
            } catch {}

            // 4. Query Related Operational Entities
            const recentNodes: UserRelationshipNode[] = [];
            const counts = {
                actionsLogged: 0,
                loansApproved: 0,
                loansManaged: 0,
                paymentsCollected: 0,
                remittancesHandled: 0,
                journalEntriesPosted: 0,
                stockMovements: 0,
                salesReturns: 0,
            };
            const totals = {
                loansVolume: 0,
                paymentsVolume: 0,
                journalEntriesVolume: 0,
            };
            const activityByModule: Record<string, number> = {};
            const activityByAction: Record<string, number> = {};
            let firstActiveAt: number | undefined;
            let lastActiveAt: number | undefined;

            // Query Action Logs metrics
            try {
                const actionLogs = await db.get<ActionLog>('action_logs')
                    .query(Q.where('performed_by', Q.oneOf(userAliases)), Q.sortBy('timestamp', Q.desc))
                    .fetch();
                counts.actionsLogged = actionLogs.length;

                if (actionLogs.length > 0) {
                    lastActiveAt = actionLogs[0].timestamp || (actionLogs[0].createdAt ? Number(actionLogs[0].createdAt) : undefined);
                    firstActiveAt = actionLogs[actionLogs.length - 1].timestamp || (actionLogs[actionLogs.length - 1].createdAt ? Number(actionLogs[actionLogs.length - 1].createdAt) : undefined);
                }

                for (const log of actionLogs) {
                    activityByAction[log.action] = (activityByAction[log.action] || 0) + 1;
                    const entityInfo = formatEntityInfo(log.entityType, log.entityId);
                    activityByModule[entityInfo.module] = (activityByModule[entityInfo.module] || 0) + 1;
                }
            } catch {}

            // Query Loans (Approved or Collector)
            try {
                const loansColl = db.get<Loan>('loans');
                if (loansColl) {
                    const approvedLoans = await loansColl.query(
                        Q.where('approved_by', Q.oneOf(userAliases)),
                        Q.where('deleted_at', Q.eq(null))
                    ).fetch();
                    counts.loansApproved = approvedLoans.length;

                    for (const l of approvedLoans) {
                        totals.loansVolume += (l.principalAmount || l.totalAmount || 0);
                        if (recentNodes.length < 15) {
                            recentNodes.push({
                                id: l.id,
                                type: 'loan',
                                title: `Loan #${l.loanNumber || l.id.substring(0, 8)}`,
                                subtitle: `Approved principal: ₱${(l.principalAmount || 0).toLocaleString()}`,
                                badge: 'Approved',
                                date: l.releaseDate ? Number(l.releaseDate) : undefined,
                                amount: l.principalAmount || l.totalAmount,
                                roleInRelation: 'approved',
                                linkRoute: `/(admin)/loans/${l.id}`,
                            });
                        }
                    }

                    const managedLoans = await loansColl.query(
                        Q.where('collector_id', Q.oneOf(userAliases)),
                        Q.where('deleted_at', Q.eq(null))
                    ).fetch();
                    counts.loansManaged = managedLoans.length;
                }
            } catch {}

            // Query Payments collected
            try {
                const paymentsColl = db.get<Payment>('payments');
                if (paymentsColl) {
                    const payments = await paymentsColl.query(
                        Q.where('collector_id', Q.oneOf(userAliases)),
                        Q.where('deleted_at', Q.eq(null)),
                        Q.sortBy('payment_date', Q.desc),
                        Q.take(50)
                    ).fetch();
                    counts.paymentsCollected = payments.length;
                    for (const p of payments) {
                        totals.paymentsVolume += (p.amount || 0);
                        if (recentNodes.length < 15) {
                            recentNodes.push({
                                id: p.id,
                                type: 'payment',
                                title: `Payment Receipt #${p.receiptNumber || p.id.substring(0, 8)}`,
                                subtitle: `Collected: ₱${(p.amount || 0).toLocaleString()}`,
                                badge: 'Collected',
                                date: p.paymentDate ? Number(p.paymentDate) : undefined,
                                amount: p.amount,
                                roleInRelation: 'collected',
                                linkRoute: '/(admin)/payments',
                            });
                        }
                    }
                }
            } catch {}

            // Query Remittances
            try {
                const remittancesColl = db.get<Remittance>('remittances');
                if (remittancesColl) {
                    const remittances = await remittancesColl.query(
                        Q.or(
                            Q.where('collector_id', Q.oneOf(userAliases)),
                            Q.where('approved_by', Q.oneOf(userAliases))
                        ),
                        Q.where('deleted_at', Q.eq(null)),
                        Q.take(20)
                    ).fetch();
                    counts.remittancesHandled = remittances.length;
                }
            } catch {}

            // Query Journal Entries posted
            try {
                const jeColl = db.get<JournalEntry>('journal_entries');
                if (jeColl) {
                    const entries = await jeColl.query(
                        Q.where('posted_by', Q.oneOf(userAliases)),
                        Q.where('deleted_at', Q.eq(null)),
                        Q.take(30)
                    ).fetch();
                    counts.journalEntriesPosted = entries.length;
                    for (const je of entries) {
                        totals.journalEntriesVolume += (je.totalDebit || 0);
                        if (recentNodes.length < 20) {
                            recentNodes.push({
                                id: je.id,
                                type: 'journal_entry',
                                title: je.description || `Entry #${je.referenceNumber || je.id.substring(0, 8)}`,
                                subtitle: `Posted Debit: ₱${(je.totalDebit || 0).toLocaleString()}`,
                                badge: 'Posted GL',
                                date: je.entryDate ? new Date(je.entryDate).getTime() : undefined,
                                amount: je.totalDebit,
                                roleInRelation: 'posted',
                                linkRoute: '/(admin)/accounting/general-ledger',
                            });
                        }
                    }
                }
            } catch {}

            // Query Stock Movements
            try {
                const smColl = db.get<StockMovement>('stock_movements');
                if (smColl) {
                    const stock = await smColl.query(
                        Q.where('performed_by', Q.oneOf(userAliases)),
                        Q.where('deleted_at', Q.eq(null))
                    ).fetch();
                    counts.stockMovements = stock.length;
                }
            } catch {}

            // Query Sales Returns
            try {
                const srColl = db.get<SalesReturn>('sales_returns');
                if (srColl) {
                    const returns = await srColl.query(
                        Q.or(
                            Q.where('created_by', Q.oneOf(userAliases)),
                            Q.where('approved_by', Q.oneOf(userAliases))
                        ),
                        Q.where('deleted_at', Q.eq(null))
                    ).fetch();
                    counts.salesReturns = returns.length;
                }
            } catch {}

            // Organization Node
            if (user.branchId) {
                recentNodes.unshift({
                    id: user.branchId,
                    type: 'branch',
                    title: branchName || 'Assigned Branch',
                    subtitle: 'Operating Branch / Business Unit',
                    badge: 'Branch',
                    roleInRelation: 'assigned',
                });
            }

            if (linkedBorrower) {
                recentNodes.unshift({
                    id: linkedBorrower.id,
                    type: 'borrower',
                    title: `Member: ${linkedBorrower.fullName}`,
                    subtitle: linkedBorrower.memberId ? `Member ID: ${linkedBorrower.memberId}` : 'Linked Member Account',
                    badge: 'Member',
                    roleInRelation: 'linked',
                    linkRoute: `/(admin)/borrowers/${linkedBorrower.id}`,
                });
            }

            return {
                user: {
                    id: user.id,
                    fullName: user.fullName || user.email,
                    email: user.email,
                    role: user.role,
                    roleLabel: ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role,
                    isActive: user.isActive,
                    branchId: user.branchId,
                    areaId: user.areaId,
                    createdAt: user.createdAt ? Number(user.createdAt) : undefined,
                },
                organization: {
                    branchId: user.branchId,
                    branchName,
                    areaId: user.areaId,
                    areaName,
                },
                linkedBorrower,
                counts,
                totals,
                recentRelatedEntities: recentNodes,
                activityByModule,
                activityByAction,
                firstActiveAt,
                lastActiveAt,
            };
        } catch (error) {
            console.error('[UserTracingService] Error building user data relationships:', error);
            return null;
        }
    }
}

export const UserTracingService = new UserTracingServiceClass();
export default UserTracingService;
