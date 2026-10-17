import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import AgriFarmWorker from '../database/models/AgriFarmWorker';
import AgriLaborLog from '../database/models/AgriLaborLog';

export interface WorkerFilterOptions {
    search?: string;
    status?: string; // 'all' | 'active' | 'inactive'
}

export interface WorkerStats {
    totalWorkers: number;
    activeWorkers: number;
    inactiveWorkers: number;
    averageDailyRate: number;
    totalWagesPaid: number;
    totalWagesPending: number;
    totalTasksCompleted: number;
}

export interface WorkerIndividualMetrics {
    tasksCount: number;
    totalEarned: number;
    paidAmount: number;
    pendingAmount: number;
}

export class AgriWorkerService {
    /**
     * Filters workers list by search query (name, specialization) and status
     */
    static filterWorkers(workers: AgriFarmWorker[], options: WorkerFilterOptions = {}): AgriFarmWorker[] {
        const search = (options.search || '').trim().toLowerCase();
        const status = options.status || 'all';

        return workers.filter(worker => {
            if (status !== 'all' && worker.status !== status) {
                return false;
            }

            if (search) {
                const nameMatch = (worker.name || '').toLowerCase().includes(search);
                const specMatch = (worker.specialization || '').toLowerCase().includes(search);
                const contactMatch = (worker.contactNumber || '').toLowerCase().includes(search);
                if (!nameMatch && !specMatch && !contactMatch) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Computes aggregate KPIs for the farm laborers & staff dashboard
     */
    static computeWorkerStats(workers: AgriFarmWorker[], logs: AgriLaborLog[]): WorkerStats {
        const totalWorkers = workers.length;
        const activeWorkers = workers.filter(w => w.status === 'active').length;
        const inactiveWorkers = totalWorkers - activeWorkers;

        const sumRates = workers.reduce((sum, w) => sum + (w.dailyRate || 0), 0);
        const averageDailyRate = totalWorkers > 0 ? Number((sumRates / totalWorkers).toFixed(2)) : 0;

        let totalWagesPaid = 0;
        let totalWagesPending = 0;

        for (const log of logs) {
            const pay = log.totalPay || 0;
            if (log.paymentStatus === 'paid') {
                totalWagesPaid += pay;
            } else if (log.paymentStatus === 'pending') {
                totalWagesPending += pay;
            }
        }

        return {
            totalWorkers,
            activeWorkers,
            inactiveWorkers,
            averageDailyRate,
            totalWagesPaid: Number(totalWagesPaid.toFixed(2)),
            totalWagesPending: Number(totalWagesPending.toFixed(2)),
            totalTasksCompleted: logs.length,
        };
    }

    /**
     * Aggregates tasks count and earned pay for a specific worker
     */
    static aggregateWorkerMetrics(workerId: string, logs: AgriLaborLog[]): WorkerIndividualMetrics {
        let tasksCount = 0;
        let totalEarned = 0;
        let paidAmount = 0;
        let pendingAmount = 0;

        for (const log of logs) {
            if (log.workerId === workerId) {
                tasksCount += 1;
                const pay = log.totalPay || 0;
                totalEarned += pay;
                if (log.paymentStatus === 'paid') {
                    paidAmount += pay;
                } else if (log.paymentStatus === 'pending') {
                    pendingAmount += pay;
                }
            }
        }

        return {
            tasksCount,
            totalEarned: Number(totalEarned.toFixed(2)),
            paidAmount: Number(paidAmount.toFixed(2)),
            pendingAmount: Number(pendingAmount.toFixed(2)),
        };
    }

    /**
     * List all workers from database
     */
    static async listWorkers(db: Database = globalDatabase): Promise<AgriFarmWorker[]> {
        return db
            .get<AgriFarmWorker>('agri_farm_workers')
            .query(
                Q.where('deleted_at', null),
                Q.sortBy('name', Q.asc)
            )
            .fetch();
    }

    /**
     * Create a new farm worker / staff record
     */
    static async createWorker(
        data: {
            name: string;
            contactNumber?: string | null;
            specialization?: string | null;
            dailyRate: number;
            status?: string;
        },
        db: Database = globalDatabase
    ): Promise<AgriFarmWorker> {
        let created: AgriFarmWorker | null = null;
        await db.write(async () => {
            created = await db.get<AgriFarmWorker>('agri_farm_workers').create(record => {
                record.name = data.name.trim();
                record.contactNumber = data.contactNumber?.trim() || null;
                record.specialization = data.specialization?.trim() || 'General Field Crew';
                record.dailyRate = data.dailyRate || 450;
                record.status = data.status || 'active';
            });
        });

        if (!created) {
            throw new Error('Failed to create farm worker record');
        }

        return created;
    }

    /**
     * Update an existing farm worker / staff record
     */
    static async updateWorker(
        worker: AgriFarmWorker,
        data: {
            name?: string;
            contactNumber?: string | null;
            specialization?: string | null;
            dailyRate?: number;
            status?: string;
        },
        db: Database = globalDatabase
    ): Promise<void> {
        await db.write(async () => {
            await worker.update(record => {
                if (data.name !== undefined) record.name = data.name.trim();
                if (data.contactNumber !== undefined) record.contactNumber = data.contactNumber?.trim() || null;
                if (data.specialization !== undefined) record.specialization = data.specialization?.trim() || null;
                if (data.dailyRate !== undefined) record.dailyRate = data.dailyRate;
                if (data.status !== undefined) record.status = data.status;
            });
        });
    }

    /**
     * Soft-delete a farm worker record
     */
    static async deleteWorker(
        worker: AgriFarmWorker,
        db: Database = globalDatabase
    ): Promise<void> {
        await db.write(async () => {
            await worker.update(record => {
                record.deletedAt = new Date();
            });
        });
    }
}

export default AgriWorkerService;
