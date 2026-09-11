import { computeSchedulePenalty, computeSchedulePenalties } from '../penalty';

describe('penalty calculation', () => {
    it('uses amount due × 5% ÷ 30 × days delayed', () => {
        const penalty = computeSchedulePenalty(
            {
                id: 'schedule-1',
                loanId: 'loan-1',
                dueDate: new Date('2026-05-01T10:00:00'),
                scheduledAmount: 1000,
                status: 'pending',
            },
            new Date('2026-05-11T08:00:00')
        );

        expect(penalty).toEqual(expect.objectContaining({
            scheduleId: 'schedule-1',
            loanId: 'loan-1',
            amountDue: 1000,
            daysDelayed: 10,
            penaltyAmount: 1000 * 0.05 / 30 * 10,
        }));
    });

    it('ignores paid, non-overdue, and zero-amount schedules', () => {
        const penalties = computeSchedulePenalties([
            { dueDate: new Date('2026-05-01'), scheduledAmount: 1000, status: 'paid' },
            { dueDate: new Date('2026-05-15'), scheduledAmount: 1000, status: 'pending' },
            { dueDate: new Date('2026-05-01'), scheduledAmount: 0, status: 'late' },
        ], new Date('2026-05-10'));

        expect(penalties).toEqual([]);
    });

    it('handles defaults and exactly 1 day delay', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const penalty = computeSchedulePenalty({
            id: 'schedule-1',
            loanId: 'loan-1',
            dueDate: yesterday,
            scheduledAmount: 1000,
            status: 'pending',
        });

        expect(penalty).not.toBeNull();
        expect(penalty?.daysDelayed).toBe(1);
        expect(penalty?.reason).toContain('1 day delayed');
        
        const penalties = computeSchedulePenalties([{
            id: 'schedule-1',
            loanId: 'loan-1',
            dueDate: yesterday,
            scheduledAmount: 1000,
            status: 'pending',
        }]);
        expect(penalties).toHaveLength(1);
    });
});

