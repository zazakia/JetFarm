import { Database, Q } from '@nozbe/watermelondb';
import Collector from '../database/models/Collector';
import { coerceMoneyAmount } from '../utils/currency';

export class CollectorCommissionServiceClass {
    private _db?: Database;

    constructor(db?: Database) {
        this._db = db;
    }

    protected get db(): Database {
        if (this._db) return this._db;
        const { database } = require('../database');
        return database;
    }

    /**
     * Link collector profile to a Member record and set commission rate (% share per collection)
     */
    async updateCollectorCommissionSettings(opts: {
        collectorId: string;
        memberId?: string;
        commissionRate: number; // e.g. 5 for 5%
    }): Promise<Collector> {
        const collection = this.db.collections.get<Collector>('collectors');
        let collector: Collector | null = null;
        try {
            collector = await collection.find(opts.collectorId);
        } catch {
            // Find by auth_id if not found by primary key
            const matches = await collection.query(Q.where('auth_id', opts.collectorId)).fetch();
            if (matches.length > 0) collector = matches[0];
        }

        if (!collector) {
            // Create collector entry if not present
            let created!: Collector;
            await this.db.write(async () => {
                created = await collection.create(record => {
                    record._raw.id = opts.collectorId;
                    record.fullName = 'Collector';
                    record.authId = opts.collectorId;
                    record.isActive = true;
                    record.commissionRate = opts.commissionRate;
                    if (opts.memberId) record.memberId = opts.memberId;
                });
            });
            return created;
        }

        await this.db.write(async () => {
            await collector!.update(r => {
                r.commissionRate = opts.commissionRate;
                if (opts.memberId !== undefined) {
                    r.memberId = opts.memberId;
                }
            });
        });

        return collector;
    }

    /**
     * Calculate collector commission based on collection total and percentage share
     */
    calculateCommission(collectionAmount: number, commissionRate: number): number {
        const amount = coerceMoneyAmount(collectionAmount);
        const rate = Math.max(0, commissionRate);
        // If rate > 1, assume whole percentage (e.g. 5 = 5%). If rate <= 1, assume decimal (e.g. 0.05 = 5%)
        const decimalRate = rate > 1 ? rate / 100 : rate;
        return Math.round(amount * decimalRate * 100) / 100;
    }
}

const instance = new CollectorCommissionServiceClass();
export { instance as CollectorCommissionService };
export default instance;
