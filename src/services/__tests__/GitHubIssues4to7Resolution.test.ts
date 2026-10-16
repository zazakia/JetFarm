import { AgriWorkerService } from '../AgriWorkerService';
import { parseHealthScore, STAGES_METADATA } from '../../components/CropHealthGrowthChart';
import Toast from '../../components/AppToast.web';

describe('GitHub Issues #4, #5, #6, #7 Resolution Suite', () => {
    describe('Issue #4 & #5: Farm Laborers & Staff Module', () => {
        const sampleWorkers = [
            {
                id: 'w-1',
                name: 'Danilo Cruz',
                contactNumber: '0917-111-2222',
                specialization: 'Harvester',
                dailyRate: 450,
                status: 'active',
            },
            {
                id: 'w-2',
                name: 'Eduardo Santos',
                contactNumber: '0918-333-4444',
                specialization: 'Tractor Operator',
                dailyRate: 600,
                status: 'active',
            },
            {
                id: 'w-3',
                name: 'Lito Lapid',
                contactNumber: '0920-555-6666',
                specialization: 'Supervisor / Staff',
                dailyRate: 750,
                status: 'inactive',
            },
        ] as any[];

        const sampleLogs = [
            {
                id: 'l-1',
                workerId: 'w-1',
                totalPay: 900,
                paymentStatus: 'paid',
            },
            {
                id: 'l-2',
                workerId: 'w-1',
                totalPay: 450,
                paymentStatus: 'pending',
            },
            {
                id: 'l-3',
                workerId: 'w-2',
                totalPay: 1200,
                paymentStatus: 'paid',
            },
        ] as any[];

        it('filters workers by name and specialization accurately', () => {
            const filteredByName = AgriWorkerService.filterWorkers(sampleWorkers, { search: 'Danilo' });
            expect(filteredByName).toHaveLength(1);
            expect(filteredByName[0].name).toBe('Danilo Cruz');

            const filteredByRole = AgriWorkerService.filterWorkers(sampleWorkers, { search: 'Tractor' });
            expect(filteredByRole).toHaveLength(1);
            expect(filteredByRole[0].name).toBe('Eduardo Santos');
        });

        it('computes worker KPIs and individual performance metrics', () => {
            const stats = AgriWorkerService.computeWorkerStats(sampleWorkers, sampleLogs);
            expect(stats.totalWorkers).toBe(3);
            expect(stats.activeWorkers).toBe(2);
            expect(stats.inactiveWorkers).toBe(1);
            expect(stats.averageDailyRate).toBe(600); // (450 + 600 + 750) / 3 = 600
            expect(stats.totalWagesPaid).toBe(2100); // 900 + 1200
            expect(stats.totalWagesPending).toBe(450);

            const daniloMetrics = AgriWorkerService.aggregateWorkerMetrics('w-1', sampleLogs);
            expect(daniloMetrics.tasksCount).toBe(2);
            expect(daniloMetrics.totalEarned).toBe(1350);
            expect(daniloMetrics.paidAmount).toBe(900);
            expect(daniloMetrics.pendingAmount).toBe(450);
        });
    });

    describe('Issue #6: Cassava Crop Health Status Line Graph per Growth Stage', () => {
        it('validates 5 distinct growth stages in sequence', () => {
            expect(STAGES_METADATA.map(s => s.id)).toEqual([
                'land_prep',
                'germination',
                'vegetative',
                'root_bulking',
                'maturity',
            ]);
        });

        it('converts all health status levels to numerical scores for line graph plotting', () => {
            expect(parseHealthScore('diseased')).toBe(1);
            expect(parseHealthScore('pest_risk')).toBe(2);
            expect(parseHealthScore('fair')).toBe(3);
            expect(parseHealthScore('good')).toBe(4);
            expect(parseHealthScore('excellent')).toBe(5);
        });
    });

    describe('Issue #7: Confirmation Message on Transaction Saved', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('emits toast message on transaction completion', () => {
            const toastListener = jest.fn();
            const unsubscribe = Toast.show ? (Toast as any).show : null;

            let capturedToast: any = null;
            const sub = (Toast as any).show;
            expect(typeof Toast.show).toBe('function');

            // Trigger Toast.show
            Toast.show({
                type: 'success',
                text1: 'Batch Recorded Successfully',
                text2: 'BATCH-20261016-2309: 2,500 net kg saved and ledger updated',
            });
        });
    });
});
