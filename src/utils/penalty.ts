type PenaltyScheduleInput = {
    id?: string;
    loanId?: string;
    dueDate: Date | number;
    scheduledAmount: number;
    status?: string;
};

export type ComputedPenaltyRow = {
    scheduleId?: string;
    loanId?: string;
    dueDate: number;
    amountDue: number;
    daysDelayed: number;
    penaltyAmount: number;
    reason: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PENALTY_RATE_PER_30_DAYS = 0.05;
const UNPAID_SCHEDULE_STATUSES = new Set(['pending', 'partial', 'late']);

function startOfLocalDay(value: Date | number): number {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function computeSchedulePenalty(
    schedule: PenaltyScheduleInput,
    asOf: Date = new Date()
): ComputedPenaltyRow | null {
    const status = (schedule.status || '').toLowerCase();
    if (status && !UNPAID_SCHEDULE_STATUSES.has(status)) {
        return null;
    }

    const amountDue = schedule.scheduledAmount || 0;
    if (amountDue <= 0) {
        return null;
    }

    const dueDate = startOfLocalDay(schedule.dueDate);
    const asOfDate = startOfLocalDay(asOf);
    const daysDelayed = Math.max(0, Math.floor((asOfDate - dueDate) / DAY_MS));

    if (daysDelayed <= 0) {
        return null;
    }

    const penaltyAmount = amountDue * PENALTY_RATE_PER_30_DAYS / 30 * daysDelayed;

    return {
        scheduleId: schedule.id,
        loanId: schedule.loanId,
        dueDate,
        amountDue,
        daysDelayed,
        penaltyAmount,
        reason: `Penalty = amount due × 5% ÷ 30 × ${daysDelayed} day${daysDelayed === 1 ? '' : 's'} delayed`,
    };
}

export function computeSchedulePenalties(
    schedules: PenaltyScheduleInput[],
    asOf: Date = new Date()
): ComputedPenaltyRow[] {
    return schedules
        .map(schedule => computeSchedulePenalty(schedule, asOf))
        .filter((penalty): penalty is ComputedPenaltyRow => Boolean(penalty));
}

