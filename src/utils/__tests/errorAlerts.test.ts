import { formatFieldName, handleFormValidationError, handleSaveError } from '../errorAlerts';
import { Alert, Platform } from 'react-native';

jest.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
    },
    Alert: {
        alert: jest.fn(),
    },
}));

describe('errorAlerts utility', () => {
    let originalAlert: any;

    beforeEach(() => {
        jest.clearAllMocks();
        if (typeof window !== 'undefined') {
            originalAlert = window.alert;
            window.alert = jest.fn();
        }
    });

    afterEach(() => {
        if (typeof window !== 'undefined') {
            window.alert = originalAlert;
        }
    });

    test('formatFieldName converts keys to title case', () => {
        expect(formatFieldName('fullName')).toBe('Full Name');
        expect(formatFieldName('cycle_id')).toBe('Cycle Id');
        expect(formatFieldName('spouse-first-name')).toBe('Spouse First Name');
        expect(formatFieldName('notes')).toBe('Notes');
    });

    test('handleFormValidationError calls Alert.alert on Native platforms', () => {
        Platform.OS = 'ios';
        const errors = {
            fullName: { message: 'Name is required' },
            cycleId: { message: 'Must be a number' },
        };
        handleFormValidationError(errors, 'Borrower');
        expect(Alert.alert).toHaveBeenCalledWith(
            'Validation Error',
            expect.stringContaining('Saving Borrower failed. Please correct the following errors before saving:\n\n- Full Name: Name is required\n- Cycle Id: Must be a number')
        );
    });

    test('handleFormValidationError calls window.alert on Web', () => {
        Platform.OS = 'web';
        const errors = {
            fullName: { message: 'Name is required' },
        };
        const mockWindowAlert = jest.fn();
        global.window = { alert: mockWindowAlert } as any;

        handleFormValidationError(errors, 'Borrower');
        expect(mockWindowAlert).toHaveBeenCalledWith(
            expect.stringContaining('Saving Borrower failed. Please correct the following errors before saving:\n\n- Full Name: Name is required')
        );
    });

    test('handleSaveError calls Alert.alert on Native platforms', () => {
        Platform.OS = 'ios';
        const error = new Error('Constraint violation error');
        handleSaveError(error, 'Borrower', 'update');
        expect(Alert.alert).toHaveBeenCalledWith(
            'Error',
            'Failed to update Borrower.\n\nReason: Constraint violation error'
        );
    });
});
