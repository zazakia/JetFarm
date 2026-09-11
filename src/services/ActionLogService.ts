import { database as globalDatabase } from '../database';
import { Database, Q } from '@nozbe/watermelondb';
import ActionLog from '../database/models/ActionLog';
import UserProfile from '../database/models/UserProfile';
import { AuthService } from './AuthService';
import { ErrorService } from "./ErrorService";
import { sanitizeAuditJsonString, sanitizeAuditPayload } from '../utils/auditPayloadSanitizer';

export type ActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';

export interface LogParams {
    entityType: string;
    entityId: string;
    action: ActionType;
    oldData?: any;
    newData?: any;
    performedBy?: string;
}

export class ActionLogService {
    private _db?: Database;

    constructor(db?: Database) {
        this._db = db;
    }

    private get db(): Database {
        const db = this._db || globalDatabase;
        if (!db) {
            ErrorService.handleError(new Error('[ActionLogService] Database is not initialized!'), '[ActionLogService] Database is not initialized!');
        }
        return db;
    }

    async logAction(params: LogParams) {
        return this.logActions([params]);
    }

    /**
     * Prepares action logs to be included in a database batch.
     * Use this when you are already inside a database.write() block.
     */
    prepareLogActionsSync(paramsList: LogParams[], defaultUser: string = 'system'): any[] {
        if (paramsList.length === 0) return [];

        const db = this.db;
        if (!db) return [];

        const collection = db.get<ActionLog>('action_logs');
        if (!collection) {
            ErrorService.handleError(new Error('[ActionLogService] action_logs collection not found!'), '[ActionLogService] action_logs collection not found!');
            return [];
        }

        return paramsList.map(params => {
            const currentUserId = params.performedBy || defaultUser;
            const entityType = params.entityType && params.entityType.trim() !== '' ? params.entityType : 'system';
            const entityId = params.entityId && params.entityId.trim() !== '' ? params.entityId : 'system';
            return collection.prepareCreate(log => {
                log.entityType = entityType;
                log.entityId = entityId;
                log.action = params.action;
                log.performedBy = currentUserId;
                log.oldData = params.oldData != null
                    ? sanitizeAuditJsonString(sanitizeAuditPayload(params.oldData))
                    : '';
                log.newData = params.newData != null
                    ? sanitizeAuditJsonString(sanitizeAuditPayload(params.newData))
                    : '';
                log.timestamp = Date.now();
            });
        });
    }

    async prepareLogActions(paramsList: LogParams[]): Promise<any[]> {
        const defaultUser = await AuthService.getCurrentUserId() || 'system';
        return this.prepareLogActionsSync(paramsList, defaultUser);
    }

    async logActions(paramsList: LogParams[]) {
        if (paramsList.length === 0) return;

        try {
            const db = this.db;
            if (!db) return;

            const preparedLogs = await this.prepareLogActions(paramsList);
            if (preparedLogs.length === 0) return;

            await db.write(async () => {
                await db.batch(...preparedLogs);
            });
        } catch (error) {
            ErrorService.handleError(error, 'Failed to log actions:');
        }
    }

    private buildLogsQuery(limit: number = 50, entityType?: string) {
        const db = this.db;
        if (!db) return null;

        let query = db.get<ActionLog>('action_logs').query();

        if (entityType) {
            query = query.extend(Q.where('entity_type', entityType));
        }

        return query.extend(Q.sortBy('timestamp', Q.desc), Q.take(limit));
    }

    async getLogs(limit: number = 50, entityType?: string) {
        try {
            const query = this.buildLogsQuery(limit, entityType);
            return query ? await query.fetch() : [];
        } catch (error) {
            ErrorService.handleError(error, 'Failed to fetch action logs:');
            return [];
        }
    }

    observeLogs(limit: number = 50, entityType?: string) {
        const query = this.buildLogsQuery(limit, entityType);
        return query ? query.observe() : null;
    }

    /**
     * Loads a map of user ID -> user profile data for fast operator resolution in audit trails.
     */
    async getUserProfilesMap(): Promise<Map<string, { id: string; fullName: string; role: string; email?: string }>> {
        const userMap = new Map<string, { id: string; fullName: string; role: string; email?: string }>();
        try {
            const db = this.db;
            if (!db) return userMap;

            const collection = db.get<UserProfile>('user_profiles');
            if (collection) {
                const profiles = await collection.query().fetch();
                for (const p of profiles) {
                    userMap.set(p.id, {
                        id: p.id,
                        fullName: p.fullName || p.email,
                        role: p.role,
                        email: p.email,
                    });
                }
            }
        } catch {
            // Gracefully ignore profile fetch errors (e.g. offline or uninitialized collection)
        }
        return userMap;
    }
}

export default new ActionLogService();
