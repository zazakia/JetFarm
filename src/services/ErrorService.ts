import Toast from '../components/AppToast';

export enum ErrorType {
    NETWORK = 'NETWORK',
    AUTH = 'AUTH',
    SYNC = 'SYNC',
    CONFIGURATION = 'CONFIGURATION',
    CONSTRAINT = 'CONSTRAINT',
    TIMEOUT = 'TIMEOUT',
    VALIDATION = 'VALIDATION',
    DATABASE = 'DATABASE',
    UNKNOWN = 'UNKNOWN',
}

export class AppError extends Error {
    type: ErrorType;
    originalError?: any;
    context?: string;

    constructor(message: string, type: ErrorType = ErrorType.UNKNOWN, originalError?: any, context?: string) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.originalError = originalError;
        this.context = context;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

class ErrorServiceClass {
    public handleError(error: any, context?: string, defaultType: ErrorType = ErrorType.UNKNOWN): AppError {
        const appError = this.normalizeError(error, context, defaultType);
        
        console.error(`[ErrorService] [${appError.type}] Context: ${context || 'N/A'}`, appError.message, appError.originalError);

        // Show user-friendly toast for most errors
        if (appError.type !== ErrorType.VALIDATION) {
            this.showErrorToast(appError);
        }

        return appError;
    }

    private normalizeError(error: any, context?: string, type?: ErrorType): AppError {
        let message = 'An unexpected error occurred';
        let detectedType = type || ErrorType.UNKNOWN;

        if (typeof error === 'string') {
            message = error;
        } else {
            if (error instanceof Error) {
                message = error.message;
            } else if (error && typeof error === 'object' && error.message) {
                message = error.message;
            }

            const originalMessage = message;
            const detectionSearch = `${originalMessage} ${error?.name || ''} ${error?.code || ''} ${error?.status || ''}`.toLowerCase();
            message = this.toUserFriendlyMessage(message, error);

            // Type detection logic
            if (detectedType === ErrorType.UNKNOWN || detectedType === ErrorType.SYNC) {
                const searchStr = `${message} ${detectionSearch}`.toLowerCase();

                if (
                    searchStr.includes('pgrst205') ||
                    searchStr.includes('schema cache') ||
                    searchStr.includes('could not find the table') ||
                    searchStr.includes('schema/configuration')
                ) {
                    detectedType = ErrorType.CONFIGURATION;
                } else if (searchStr.includes('timed out') || searchStr.includes('timeout')) {
                    detectedType = ErrorType.TIMEOUT;
                } else if (
                    searchStr.includes('23503') ||
                    searchStr.includes('23505') ||
                    searchStr.includes('foreign key') ||
                    searchStr.includes('duplicate key') ||
                    searchStr.includes('constraint')
                ) {
                    detectedType = ErrorType.CONSTRAINT;
                } else if (searchStr.includes('network') || searchStr.includes('fetch')) {
                    detectedType = ErrorType.NETWORK;
                } else if (searchStr.includes('auth') || searchStr.includes('permission') || searchStr.includes('session')) {
                    detectedType = ErrorType.AUTH;
                } else if (error?.name === 'WatermelonDBError' || searchStr.includes('database') || searchStr.includes('sqlite')) {
                    detectedType = ErrorType.DATABASE;
                }
            }
        }

        return new AppError(message, detectedType, error, context);
    }

    private toUserFriendlyMessage(message: string, error?: any): string {
        const search = `${message} ${error?.name || ''} ${error?.code || ''} ${error?.status || ''}`.toLowerCase();

        if (
            search.includes('pgrst205') ||
            search.includes('schema cache') ||
            search.includes('could not find the table') ||
            search.includes('schema/configuration')
        ) {
            return 'The server database schema is incomplete or unavailable. Please apply the required Supabase migrations or contact an administrator.';
        }

        if (search.includes('invalid login credentials')) {
            return 'Email or password is incorrect. Please check your credentials and try again.';
        }

        if (search.includes('email not confirmed')) {
            return 'Your email is not verified yet. Please contact an administrator for approval.';
        }

        if (search.includes('auth session missing') || search.includes('session_not_found')) {
            return 'Your session has ended. Please sign in again.';
        }

        if (search.includes('failed to fetch') || search.includes('network request failed') || search.includes('networkerror')) {
            return 'Connection problem. Please check your internet connection and try again.';
        }

        if (search.includes('rate limit')) {
            return 'Too many attempts. Please wait a few minutes and try again.';
        }

        if (search.includes('permission denied') || search.includes('row-level security') || search.includes('rls')) {
            return 'You do not have permission to do that. Please contact an administrator.';
        }

        return message || 'An unexpected error occurred';
    }

    private showErrorToast(error: AppError) {
        let title = 'Error';
        
        switch (error.type) {
            case ErrorType.AUTH:
                title = 'Authentication Error';
                break;
            case ErrorType.SYNC:
                title = 'Sync Failed';
                break;
            case ErrorType.NETWORK:
                title = 'Connection Issue';
                break;
            case ErrorType.DATABASE:
                title = 'Database Error';
                break;
            case ErrorType.CONFIGURATION:
                title = 'Database Configuration Error';
                break;
            case ErrorType.CONSTRAINT:
                title = 'Data Conflict';
                break;
            case ErrorType.TIMEOUT:
                title = 'Request Timed Out';
                break;
        }

        try {
            Toast.show({
                type: 'error',
                text1: title,
                text2: error.message,
                position: 'bottom',
                visibilityTime: 4000,
            });
        } catch (toastErr) {
            console.warn('[ErrorService] Toast.show failed (likely library incompatibility):', toastErr);
        }
    }

    public getUserMessage(error: any, fallback = 'Something went wrong. Please try again.'): string {
        return this.normalizeError(error, undefined, ErrorType.UNKNOWN).message || fallback;
    }

    public showSuccessToast(message: string, title: string = 'Success') {
        try {
            Toast.show({
                type: 'success',
                text1: title,
                text2: message,
                position: 'bottom',
                visibilityTime: 3000,
            });
        } catch (toastErr) {
            console.warn('[ErrorService] Toast.show failed:', toastErr);
        }
    }

    public showInfoToast(message: string, title: string = 'Info') {
        try {
            Toast.show({
                type: 'info',
                text1: title,
                text2: message,
                position: 'bottom',
                visibilityTime: 3000,
            });
        } catch (toastErr) {
            console.warn('[ErrorService] Toast.show failed:', toastErr);
        }
    }
}

export const ErrorService = new ErrorServiceClass();
