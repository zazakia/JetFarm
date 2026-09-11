import { ErrorService, ErrorType } from '../ErrorService';
import Toast from '../../components/AppToast';

jest.mock('../../components/AppToast', () => ({
    show: jest.fn(),
}));

describe('ErrorService', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('handleError', () => {
        it('normalizes a string error', () => {
            const appError = ErrorService.handleError('Simple error');
            expect(appError.message).toBe('Simple error');
            expect(appError.type).toBe(ErrorType.UNKNOWN);
        });

        it('normalizes an Error object', () => {
            const error = new Error('Test error');
            const appError = ErrorService.handleError(error, 'TestContext');
            expect(appError.message).toBe('Test error');
            expect(appError.context).toBe('TestContext');
        });

        it('normalizes a WatermelonDB error', () => {
            const error = new Error('Validation failed');
            (error as any).name = 'WatermelonDBError';
            const appError = ErrorService.handleError(error);
            expect(appError.type).toBe(ErrorType.DATABASE);
        });

        it('correctly normalizes validation errors', () => {
            const appError = ErrorService.handleError('Field required', 'ctx', ErrorType.VALIDATION);
            expect(appError.type).toBe(ErrorType.VALIDATION);
        });

        it('handles non-Error objects with a message property', () => {
            const error = { message: 'Object error' };
            const appError = ErrorService.handleError(error);
            expect(appError.message).toBe('Object error');
        });

        it('detects context from various Error objects', () => {
            const error = { message: 'Auth failed' };
            const appError = ErrorService.handleError(error);
            expect(appError.type).toBe(ErrorType.AUTH);
        });

        it('detects network errors', () => {
            const error = new Error('Failed to fetch data');
            const appError = ErrorService.handleError(error);
            expect(appError.type).toBe(ErrorType.NETWORK);
        });
    });

    describe('toasts', () => {
        it('shows specific toast for SYNC error', () => {
            ErrorService.handleError('sync fail', 'sync', ErrorType.SYNC);
            expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
                text1: 'Sync Failed'
            }));
        });

        it('shows specific toast for DATABASE error', () => {
            ErrorService.handleError('db fail', 'db', ErrorType.DATABASE);
            expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
                text1: 'Database Error'
            }));
        });

        it('shows success and info toasts', () => {
            ErrorService.showSuccessToast('Job done');
            expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
                type: 'success',
                text2: 'Job done'
            }));

            ErrorService.showInfoToast('Heads up');
            expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
                type: 'info',
                text2: 'Heads up'
            }));
        });
    });
});
