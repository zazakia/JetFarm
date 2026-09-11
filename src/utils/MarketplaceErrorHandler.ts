/**
 * Marketplace Error Handler & Hardening Utility (brayhard standard)
 * Wraps service calls and maps raw database / network exceptions to human-friendly action messages.
 */

export interface SafeResult<T> {
    success: boolean;
    data?: T;
    userMessage: string;
    rawError?: any;
}

export async function safeMarketplaceExecute<T>(
    operationName: string,
    operation: () => Promise<T>
): Promise<SafeResult<T>> {
    try {
        const data = await operation();
        return {
            success: true,
            data,
            userMessage: 'Operation completed successfully.',
        };
    } catch (error: any) {
        console.error(`[Marketplace Hardening Log - ${operationName}]:`, error);

        let friendlyMessage = 'An unexpected error occurred in the marketplace. Please try again.';

        const errStr = String(error?.message || error || '');

        if (errStr.includes('Insufficient coop savings wallet balance')) {
            friendlyMessage = errStr;
        } else if (errStr.includes('No pending completed sub-orders')) {
            friendlyMessage = 'No completed sales are available for payout at this time.';
        } else if (errStr.includes('schema cache') || errStr.includes('PGRST205')) {
            friendlyMessage = 'We are updating our catalog system. Please refresh your local app setup.';
        } else if (errStr.includes('502') || errStr.includes('503') || errStr.includes('Network request failed')) {
            friendlyMessage = 'The coop server is temporarily busy or offline. Your marketplace entries are saved locally.';
        } else if (errStr.includes('JWT') || errStr.includes('401') || errStr.includes('Unauthorized')) {
            friendlyMessage = 'Your member security session expired. Please re-authenticate to complete your transaction.';
        } else if (errStr.includes('not found')) {
            friendlyMessage = 'The requested store or product listing could not be found or has been updated.';
        }

        return {
            success: false,
            userMessage: friendlyMessage,
            rawError: error,
        };
    }
}

/**
 * Input Sanitization Helper
 */
export function sanitizeMarketplaceInput(text: string | null | undefined): string {
    if (!text) return '';
    return text.trim().replace(/[\0\x08\x0B\x0C\r]/g, '');
}

/**
 * Numeric Hardening & Boundary Clamp Helper
 */
export function clampNonNegative(val: number | null | undefined, fallback: number = 0): number {
    if (val === null || val === undefined || isNaN(val)) return fallback;
    return Math.max(0, val);
}
