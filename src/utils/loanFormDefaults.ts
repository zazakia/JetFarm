interface ShouldDefaultDailyTermParams {
    isEditing: boolean;
    previousTermUnit?: string;
    nextTermUnit?: string;
    currentTerm?: string;
}

export function shouldAutoPopulateLoanCycle(isEditing: boolean, borrowerId?: string): boolean {
    return !isEditing && !!borrowerId;
}

export function shouldDefaultDailyTerm({
    isEditing,
    previousTermUnit,
    nextTermUnit,
    currentTerm,
}: ShouldDefaultDailyTermParams): boolean {
    return !isEditing
        && previousTermUnit !== 'days'
        && nextTermUnit === 'days'
        && currentTerm !== '40';
}
