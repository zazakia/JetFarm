import {
    shouldAutoPopulateLoanCycle,
    shouldDefaultDailyTerm,
} from '../loanFormDefaults';

describe('loan form defaults', () => {
    it('does not auto-overwrite loan cycle while editing an existing loan', () => {
        expect(shouldAutoPopulateLoanCycle(true, 'borrower-1')).toBe(false);
    });

    it('auto-populates loan cycle when in create mode with borrower selected', () => {
        expect(shouldAutoPopulateLoanCycle(false, 'borrower-1')).toBe(true);
        expect(shouldAutoPopulateLoanCycle(false, undefined)).toBe(false);
    });

    it('only defaults days term when switching from a non-days unit in create mode', () => {
        expect(shouldDefaultDailyTerm({
            isEditing: false,
            previousTermUnit: 'months',
            nextTermUnit: 'days',
            currentTerm: '6',
        })).toBe(true);

        expect(shouldDefaultDailyTerm({
            isEditing: true,
            previousTermUnit: 'months',
            nextTermUnit: 'days',
            currentTerm: '25',
        })).toBe(false);

        expect(shouldDefaultDailyTerm({
            isEditing: false,
            previousTermUnit: 'days',
            nextTermUnit: 'days',
            currentTerm: '25',
        })).toBe(false);
    });
});
