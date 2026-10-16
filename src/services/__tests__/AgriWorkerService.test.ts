import { AgriWorkerService } from '../AgriWorkerService';

describe('AgriWorkerService', () => {
    const mockWorkers = [
        {
            id: 'w-1',
            name: 'Juan dela Cruz',
            contactNumber: '09171234567',
            specialization: 'Harvester',
            dailyRate: 450,
            status: 'active',
        },
        {
            id: 'w-2',
            name: 'Pedro Penduko',
            contactNumber: '09189876543',
            specialization: 'Tractor Operator',
            dailyRate: 600,
            status: 'active',
        },
        {
            id: 'w-3',
            name: 'Maria Clara',
            contactNumber: '09205551234',
            specialization: 'Supervisor / Staff',
            dailyRate: 700,
            status: 'inactive',
        },
    ] as any[];

    const mockLogs = [
        {
            id: 'log-1',
            workerId: 'w-1',
            task: 'Cassava Stem Cutting',
            totalPay: 900,
            paymentStatus: 'paid',
        },
        {
            id: 'log-2',
            workerId: 'w-1',
            task: 'Harvest Weigh-in Loading',
            totalPay: 450,
            paymentStatus: 'pending',
        },
        {
            id: 'log-3',
            workerId: 'w-2',
            task: 'Tractor Land Plowing',
            totalPay: 1200,
            paymentStatus: 'paid',
        },
    ] as any[];

    describe('filterWorkers', () => {
        it('filters workers by name matching search term case-insensitively', () => {
            const result = AgriWorkerService.filterWorkers(mockWorkers, { search: 'pedro' });
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Pedro Penduko');
        });

        it('filters workers by specialization', () => {
            const result = AgriWorkerService.filterWorkers(mockWorkers, { search: 'harvester' });
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('w-1');
        });

        it('filters workers by status', () => {
            const active = AgriWorkerService.filterWorkers(mockWorkers, { status: 'active' });
            expect(active).toHaveLength(2);

            const inactive = AgriWorkerService.filterWorkers(mockWorkers, { status: 'inactive' });
            expect(inactive).toHaveLength(1);
            expect(inactive[0].name).toBe('Maria Clara');
        });

        it('returns all workers if search is empty and status is all', () => {
            const all = AgriWorkerService.filterWorkers(mockWorkers, { search: '', status: 'all' });
            expect(all).toHaveLength(3);
        });
    });

    describe('computeWorkerStats', () => {
        it('computes aggregated counts, averages, and wage totals', () => {
            const stats = AgriWorkerService.computeWorkerStats(mockWorkers, mockLogs);

            expect(stats.totalWorkers).toBe(3);
            expect(stats.activeWorkers).toBe(2);
            expect(stats.inactiveWorkers).toBe(1);
            expect(stats.averageDailyRate).toBe(583.33); // (450 + 600 + 700) / 3 = 583.33
            expect(stats.totalWagesPaid).toBe(2100); // 900 + 1200
            expect(stats.totalWagesPending).toBe(450); // 450
            expect(stats.totalTasksCompleted).toBe(3);
        });

        it('handles empty lists gracefully', () => {
            const stats = AgriWorkerService.computeWorkerStats([], []);
            expect(stats.totalWorkers).toBe(0);
            expect(stats.activeWorkers).toBe(0);
            expect(stats.averageDailyRate).toBe(0);
            expect(stats.totalWagesPaid).toBe(0);
            expect(stats.totalWagesPending).toBe(0);
            expect(stats.totalTasksCompleted).toBe(0);
        });
    });

    describe('aggregateWorkerMetrics', () => {
        it('computes tasks and earnings for a single worker', () => {
            const metrics = AgriWorkerService.aggregateWorkerMetrics('w-1', mockLogs);
            expect(metrics.tasksCount).toBe(2);
            expect(metrics.totalEarned).toBe(1350); // 900 + 450
            expect(metrics.paidAmount).toBe(900);
            expect(metrics.pendingAmount).toBe(450);
        });

        it('returns zeros for a worker with no logs', () => {
            const metrics = AgriWorkerService.aggregateWorkerMetrics('w-3', mockLogs);
            expect(metrics.tasksCount).toBe(0);
            expect(metrics.totalEarned).toBe(0);
            expect(metrics.paidAmount).toBe(0);
            expect(metrics.pendingAmount).toBe(0);
        });
    });
});
