import { BorrowerPortalService } from '../BorrowerPortalService';
import { supabase } from '../../database/supabase';

// Mock Supabase
jest.mock('../../database/supabase', () => ({
    supabase: {
        from: jest.fn(),
        auth: {
            signUp: jest.fn(),
        },
        functions: {
            invoke: jest.fn(),
        },
    },
}));

// Mock EncryptionService
jest.mock('../EncryptionService', () => ({
    EncryptionService: {
        decrypt: jest.fn((val: string) => {
            if (val && typeof val === 'string' && val.startsWith('AES::v1::')) {
                return val.replace('AES::v1::', '');
            }
            return val;
        }),
    },
}));

describe('BorrowerPortalService', () => {
    const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://localhost:45421';
    });

    afterEach(() => {
        if (originalSupabaseUrl === undefined) {
            delete process.env.EXPO_PUBLIC_SUPABASE_URL;
        } else {
            process.env.EXPO_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
        }
        delete process.env.EXPO_PUBLIC_REGISTER_BORROWER_FUNCTION_ENABLED;
    });

    const createMockSupabaseChain = (data: any = null, error: any = null) => {
        const chain: any = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            upsert: jest.fn(),
            maybeSingle: jest.fn(),
            single: jest.fn(),
            then: (resolve: any) => resolve({ data, error }),
        };
        chain.maybeSingle.mockResolvedValue({ data, error });
        chain.single.mockResolvedValue({ data, error });
        chain.upsert.mockResolvedValue({ data, error });
        return chain;
    };

    describe('getBorrowerProfile', () => {
        it('fetches successfully', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain({ id: 'b1' }));
            const result = await BorrowerPortalService.getBorrowerProfile('u1');
            expect(result?.id).toBe('b1');
        });
        it('throws error', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain(null, new Error('DB Err')));
            await expect(BorrowerPortalService.getBorrowerProfile('u1')).rejects.toThrow();
        });
        it('decrypts phone and address fields during mapping', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain({
                id: 'b1',
                phone: 'AES::v1::09171234567',
                address: 'AES::v1::123 Main St'
            }));
            const result = await BorrowerPortalService.getBorrowerProfile('u1');
            expect(result?.phone).toBe('09171234567');
            expect(result?.address).toBe('123 Main St');
        });
        it('uses name fallback and links auth_id when direct lookup fails', async () => {
            let callCount = 0;
            (supabase.from as jest.Mock).mockImplementation((table) => {
                callCount++;
                if (table === 'app_borrowers') {
                    if (callCount === 1) {
                        return createMockSupabaseChain(null);
                    }
                    if (callCount === 3) {
                        return createMockSupabaseChain({ id: 'b_matched', full_name: 'Jane Doe' });
                    }
                    if (callCount === 4) {
                        return {
                            update: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                        };
                    }
                }
                if (table === 'user_profiles') {
                    return createMockSupabaseChain({ id: 'u1', full_name: 'Jane Doe' });
                }
                return createMockSupabaseChain(null);
            });

            const result = await BorrowerPortalService.getBorrowerProfile('u1');
            expect(result?.id).toBe('b_matched');
            expect(result?.fullName).toBe('Jane Doe');
        });
    });

    describe('getLoans', () => {
        it('fetches loans', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain([{ id: 'l1' }]));
            const result = await BorrowerPortalService.getLoans('b1', 'all');
            expect(result).toHaveLength(1);
        });
        it('filters by status', async () => {
             const chain = createMockSupabaseChain([]);
             (supabase.from as jest.Mock).mockReturnValue(chain);
             await BorrowerPortalService.getLoans('b1', 'active');
             expect(chain.eq).toHaveBeenCalledWith('status', 'active');
        });
        it('throws error', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain(null, new Error('DB Err')));
            await expect(BorrowerPortalService.getLoans('b1')).rejects.toThrow();
        });
    });

    describe('getLoanDetail', () => {
        it('fetches full detail', async () => {
            (supabase.from as jest.Mock).mockImplementation((table) => {
                if (table === 'app_loans') return createMockSupabaseChain({ id: 'l1', total_amount: 1000 });
                if (table === 'app_payments') return createMockSupabaseChain([{ amount: 500 }]);
                return createMockSupabaseChain([{ id: 's1' }]);
            });
            const result = await BorrowerPortalService.getLoanDetail('l1', 'b1');
            expect(result?.totalPaid).toBe(500);
        });

        it('returns null if loan not found', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain(null));
            expect(await BorrowerPortalService.getLoanDetail('l1', 'b1')).toBeNull();
        });

        it('throws on loan fetch error', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain(null, new Error('Loan Err')));
            await expect(BorrowerPortalService.getLoanDetail('l1', 'b1')).rejects.toThrow('Loan Err');
        });

        it('throws on payments fetch error', async () => {
            (supabase.from as jest.Mock).mockImplementation((table) => {
                if (table === 'app_loans') return createMockSupabaseChain({ id: 'l1' });
                return createMockSupabaseChain(null, new Error('Payments Err'));
            });
            await expect(BorrowerPortalService.getLoanDetail('l1', 'b1')).rejects.toThrow('Payments Err');
        });

        it('throws on schedules fetch error', async () => {
            (supabase.from as jest.Mock).mockImplementation((table) => {
                if (table === 'app_loans') return createMockSupabaseChain({ id: 'l1' });
                if (table === 'app_payments') return createMockSupabaseChain([]);
                return createMockSupabaseChain(null, new Error('Schedules Err'));
            });
            await expect(BorrowerPortalService.getLoanDetail('l1', 'b1')).rejects.toThrow('Schedules Err');
        });
    });

    describe('getPayments', () => {
        it('fetches payments', async () => {
            (supabase.from as jest.Mock).mockImplementation((table) => {
                if (table === 'app_loans') return createMockSupabaseChain([{ id: 'l1', loan_number: 'LN1' }]);
                return createMockSupabaseChain([{ id: 'p1', loan_id: 'l1', amount: 100 }]);
            });
            const result = await BorrowerPortalService.getPayments('b1');
            expect(result[0].loanNumber).toBe('LN1');
        });

        it('returns empty if no loans', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain([]));
            expect(await BorrowerPortalService.getPayments('b1')).toEqual([]);
        });

        it('throws on loans fetch error', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain(null, new Error('L Err')));
            await expect(BorrowerPortalService.getPayments('b1')).rejects.toThrow('L Err');
        });

        it('throws on payments fetch error', async () => {
            (supabase.from as jest.Mock).mockImplementation((table) => {
                if (table === 'app_loans') return createMockSupabaseChain([{ id: 'l1' }]);
                return createMockSupabaseChain(null, new Error('Pay Err'));
            });
            await expect(BorrowerPortalService.getPayments('b1')).rejects.toThrow('Pay Err');
        });
    });

    describe('getPaymentSchedules', () => {
        it('fetches schedules', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain([{ id: 's1' }]));
            const result = await BorrowerPortalService.getPaymentSchedules('l1');
            expect(result).toHaveLength(1);
        });
        it('throws error', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain(null, new Error('Sch Err')));
            await expect(BorrowerPortalService.getPaymentSchedules('l1')).rejects.toThrow();
        });
    });

    describe('getDashboardStats', () => {
        it('calculates stats', async () => {
            let call = 0;
            (supabase.from as jest.Mock).mockImplementation((table) => {
                call++;
                if (table === 'app_loans' && call === 1) return createMockSupabaseChain([{ id: 'l1', total_amount: 1000, installment_amount: 100 }]);
                if (table === 'app_payments' && call === 2) return createMockSupabaseChain([{ loan_id: 'l1', amount: 300 }]);
                if (table === 'app_loans' && call === 3) return createMockSupabaseChain([{ id: 'l1' }]);
                if (table === 'app_payments' && call === 4) return createMockSupabaseChain([{ amount: 300 }]);
                if (table === 'app_payment_schedules') return createMockSupabaseChain([{ due_date: '2099-01-01', scheduled_amount: 100 }]);
                return createMockSupabaseChain();
            });
            const stats = await BorrowerPortalService.getDashboardStats('b1');
            expect(stats.totalOutstanding).toBe(700);
        });

        it('returns zeros if no active loans', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain([]));
            const stats = await BorrowerPortalService.getDashboardStats('b1');
            expect(stats.activeLoansCount).toBe(0);
        });

        it('throws on loans fetch error', async () => {
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain(null, new Error('DL Err')));
            await expect(BorrowerPortalService.getDashboardStats('b1')).rejects.toThrow('DL Err');
        });

        it('throws on payments fetch error', async () => {
            let call = 0;
            (supabase.from as jest.Mock).mockImplementation((table) => {
                call++;
                if (table === 'app_loans') return createMockSupabaseChain([{id: 'l1'}]);
                return createMockSupabaseChain(null, new Error('DP Err'));
            });
            await expect(BorrowerPortalService.getDashboardStats('b1')).rejects.toThrow('DP Err');
        });
    });

    describe('registerBorrower', () => {
        it('registers successfully', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: new Error('Function not deployed') });
            (supabase.auth.signUp as jest.Mock).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
            const profileChain = createMockSupabaseChain({});
            (supabase.from as jest.Mock).mockReturnValue(profileChain);
            const res = await BorrowerPortalService.registerBorrower('a@b.com', '123', 'John', '123');
            expect(res.success).toBe(true);
            expect(profileChain.upsert).toHaveBeenCalledWith(expect.objectContaining({
                role: 'borrower',
                is_active: false,
            }));
            expect(res.message).toContain('administrator to verify and approve');
        });
        it('uses server-side registration when available to avoid signup email rate limits', async () => {
            process.env.EXPO_PUBLIC_REGISTER_BORROWER_FUNCTION_ENABLED = 'true';
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: { success: true, message: 'Created without auth email.' },
                error: null,
            });

            const res = await BorrowerPortalService.registerBorrower('A@B.COM ', '12345678', ' John ', ' 123 ');

            expect(res).toEqual({ success: true, message: 'Created without auth email.' });
            expect(supabase.functions.invoke).toHaveBeenCalledWith('register-borrower', {
                body: {
                    email: 'a@b.com',
                    password: '12345678',
                    fullName: 'John',
                    phone: '123',
                },
            });
            expect(supabase.auth.signUp).not.toHaveBeenCalled();
            expect(supabase.from).not.toHaveBeenCalled();
        });
        it('handles auth error', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: new Error('Function not deployed') });
            (supabase.auth.signUp as jest.Mock).mockResolvedValue({ data: { user: null }, error: new Error('Auth Err') });
            const res = await BorrowerPortalService.registerBorrower('a@b.com', '123', 'John', '123');
            expect(res.success).toBe(false);
            expect(res.message).toBe('Auth Err');
        });
        it('falls back to simple hosted auth signup when optional server-side registration is unavailable', async () => {
            process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
            process.env.EXPO_PUBLIC_REGISTER_BORROWER_FUNCTION_ENABLED = 'true';
            (supabase.functions.invoke as jest.Mock).mockRejectedValue(new Error('Failed to fetch'));
            (supabase.auth.signUp as jest.Mock).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
            const profileChain = createMockSupabaseChain({});
            (supabase.from as jest.Mock).mockReturnValue(profileChain);

            const res = await BorrowerPortalService.registerBorrower('a@b.com', '12345678', 'John', '123');

            expect(res.success).toBe(true);
            expect(supabase.auth.signUp).toHaveBeenCalled();
            expect(profileChain.upsert).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
        });
        it('uses simple auth signup without calling edge function when registration function is explicitly disabled', async () => {
            process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
            process.env.EXPO_PUBLIC_REGISTER_BORROWER_FUNCTION_ENABLED = 'false';
            (supabase.auth.signUp as jest.Mock).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain({}));

            const res = await BorrowerPortalService.registerBorrower('a@b.com', '12345678', 'John', '123');

            expect(res.success).toBe(true);
            expect(supabase.functions.invoke).not.toHaveBeenCalled();
            expect(supabase.auth.signUp).toHaveBeenCalled();
        });

        it('prefers server-side registration by default on hosted Supabase projects', async () => {
            process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: { success: true, message: 'Hosted function registered borrower.' },
                error: null,
            });

            const res = await BorrowerPortalService.registerBorrower('hosted@example.com', '12345678', 'Hosted User', '555');

            expect(res).toEqual({ success: true, message: 'Hosted function registered borrower.' });
            expect(supabase.functions.invoke).toHaveBeenCalledWith('register-borrower', expect.any(Object));
            expect(supabase.auth.signUp).not.toHaveBeenCalled();
        });
        it('shows clear guidance for Supabase signup rate limits', async () => {
            (supabase.auth.signUp as jest.Mock).mockResolvedValue({
                data: { user: null },
                error: new Error('email rate limit exceeded'),
            });

            const res = await BorrowerPortalService.registerBorrower('a@b.com', '12345678', 'John', '123');

            expect(res.success).toBe(false);
            expect(res.message).toContain('turn off email confirmations');
        });
        it('handles missing user in auth response', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: new Error('Function not deployed') });
            (supabase.auth.signUp as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });
            const res = await BorrowerPortalService.registerBorrower('a@b.com', '123', 'John', '123');
            expect(res.success).toBe(false);
            expect(res.message).toBe('Failed to create user account.');
        });
        it('handles profile error with partial success', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: new Error('Function not deployed') });
            (supabase.auth.signUp as jest.Mock).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
            (supabase.from as jest.Mock).mockReturnValue(createMockSupabaseChain(null, new Error('Prof Err')));
            const res = await BorrowerPortalService.registerBorrower('a@b.com', '123', 'John', '123');
            expect(res.success).toBe(true);
            expect(res.message).toContain('Account created but profile setup had an issue');
        });
        it('handles general catch block error', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: new Error('Function not deployed') });
            (supabase.auth.signUp as jest.Mock).mockRejectedValue(new Error('Catch Err'));
            const res = await BorrowerPortalService.registerBorrower('a@b.com', '123', 'John', '123');
            expect(res.success).toBe(false);
            expect(res.message).toBe('Catch Err');
        });
    });
});
