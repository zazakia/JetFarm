import { AuthService } from '../AuthService';
import { supabase } from '../../database/supabase';
import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';

// Mock ErrorService
jest.mock('../ErrorService', () => ({
    ErrorService: {
        handleError: jest.fn((err, context) => {
            console.error(`[ErrorService] Context: ${context}`, err);
            if (err?.message === 'Invalid login credentials') {
                return Object.assign(new Error('Email or password is incorrect. Please check your credentials and try again.'), { originalError: err });
            }
            return err;
        }),
        getUserMessage: jest.fn((err) => err?.message || 'Friendly error'),
        showErrorToast: jest.fn(),
        showSuccessToast: jest.fn(),
        showInfoToast: jest.fn(),
    },
    ErrorType: {
        AUTH: 'AUTH',
        SYNC: 'SYNC',
        NETWORK: 'NETWORK',
        UNKNOWN: 'UNKNOWN',
    }
}));

const mockAuthChain = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn().mockImplementation(function(this: any, resolve: any) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
    })
};

jest.mock('../../database/supabase', () => ({
    supabase: {
        auth: {
            signInWithPassword: jest.fn(),
            signOut: jest.fn().mockResolvedValue({ error: null }),
            getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
            getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
            resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
        },
        from: jest.fn(() => mockAuthChain),
    },
    clearPersistedAuthSession: jest.fn().mockResolvedValue(undefined),
}));

const mockAuthCollection = {
    find: jest.fn(),
    query: jest.fn().mockReturnThis(),
    fetch: jest.fn().mockResolvedValue([]),
};

jest.mock('../../database', () => ({
    database: {
        get: jest.fn(() => mockAuthCollection),
        collections: {
            get: jest.fn(() => mockAuthCollection)
        },
        write: jest.fn((callback) => callback()),
        unsafeResetDatabase: jest.fn(),
    }
}));

describe('AuthService', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalQuickLoginSetting = process.env.EXPO_PUBLIC_ENABLE_QUICK_LOGIN;
    const originalWindow = (globalThis as any).window;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockAuthChain.maybeSingle.mockResolvedValue({ data: null, error: null });
        mockAuthChain.then.mockImplementation(function(this: any, resolve: any) {
            return Promise.resolve({ data: [], error: null }).then(resolve);
        });
        mockAuthCollection.find.mockReset();
        mockAuthCollection.query.mockReturnThis();
        mockAuthCollection.fetch.mockResolvedValue([]);
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
        process.env.NODE_ENV = originalNodeEnv;
        if (originalQuickLoginSetting === undefined) {
            delete process.env.EXPO_PUBLIC_ENABLE_QUICK_LOGIN;
        } else {
            process.env.EXPO_PUBLIC_ENABLE_QUICK_LOGIN = originalQuickLoginSetting;
        }
        if (originalWindow === undefined) {
            delete (globalThis as any).window;
        } else {
            (globalThis as any).window = originalWindow;
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('isQuickLoginEnabled', () => {
        it('enables quick login on localhost even for production-style web builds', () => {
            process.env.NODE_ENV = 'production';
            delete process.env.EXPO_PUBLIC_ENABLE_QUICK_LOGIN;
            (globalThis as any).window = { location: { hostname: '127.0.0.1' } };

            expect(AuthService.isQuickLoginEnabled()).toBe(true);
        });

        it('honors an explicit false override', () => {
            process.env.NODE_ENV = 'development';
            process.env.EXPO_PUBLIC_ENABLE_QUICK_LOGIN = 'false';

            expect(AuthService.isQuickLoginEnabled()).toBe(false);
        });

        it('honors an explicit true override', () => {
            process.env.EXPO_PUBLIC_ENABLE_QUICK_LOGIN = 'true';

            expect(AuthService.isQuickLoginEnabled()).toBe(true);
        });

        it('returns true in production by default when no explicit override is set', () => {
            process.env.NODE_ENV = 'production';
            delete process.env.EXPO_PUBLIC_ENABLE_QUICK_LOGIN;
            delete (globalThis as any).window;

            expect(AuthService.isQuickLoginEnabled()).toBe(true);
        });
    });

    describe('signIn', () => {
        it('signs in successfully', async () => {
            (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
            await AuthService.signIn('a@b.com', 'pass');
            expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
        });
        it('throws on error', async () => {
            (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ error: new Error('Fail') });
            await expect(AuthService.signIn('a', 'b')).rejects.toThrow('Fail');
        });
        it('normalizes invalid credentials to a friendly error', async () => {
            (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ error: new Error('Invalid login credentials') });
            await expect(AuthService.signIn('a', 'b')).rejects.toThrow('Email or password is incorrect');
        });
        it('signs back out and blocks login when profile is pending admin approval', async () => {
            (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
            mockAuthChain.maybeSingle.mockResolvedValue({
                data: { role: 'borrower', is_active: false, deleted_at: null },
                error: null,
            });

            await expect(AuthService.signIn('pending@borrower.com', 'pass')).rejects.toThrow('pending admin approval');
            expect(supabase.auth.signOut).toHaveBeenCalled();
        });

        it('warns but does not throw when profile check returns error after signIn', async () => {
            (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
            mockAuthChain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Profile lookup failed' } });

            await expect(AuthService.signIn('a@b.com', 'pass')).resolves.toBeUndefined();
        });
    });

    describe('quickSignIn', () => {
        it('uses real Supabase auth on the production Cloudflare host', async () => {
            const localStorageMock = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
            const dispatchEventMock = jest.fn();
            (globalThis as any).window = {
                location: { hostname: 'jetfarm.pages.dev', port: '' },
                localStorage: localStorageMock,
                dispatchEvent: dispatchEventMock,
            };
            (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ data: { user: { id: 'admin' } }, error: null });

            await AuthService.quickSignIn('admin@agri-one.com', '12345678');

            expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
                email: 'admin@agri-one.com',
                password: '12345678',
            });
            expect(localStorageMock.setItem).not.toHaveBeenCalled();
            expect(dispatchEventMock).not.toHaveBeenCalled();
        });
    });

    describe('signIn - E2E (localhost:19009)', () => {
        it('signs in with valid E2E credentials without calling Supabase', async () => {
            const localStorageMock = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
            const dispatchEventMock = jest.fn();
            (globalThis as any).window = {
                location: { hostname: 'localhost', port: '19009' },
                localStorage: localStorageMock,
                dispatchEvent: dispatchEventMock,
            };
            process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD = 'testpass';

            await AuthService.signIn('cybergada@gmail.com', 'testpass');

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'jetfarm:e2e-auth-user',
                expect.stringContaining('cybergada')
            );
            expect(dispatchEventMock).toHaveBeenCalled();
            expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
        });

        it('throws on E2E sign in with wrong password', async () => {
            (globalThis as any).window = {
                location: { hostname: 'localhost', port: '19009' },
                localStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
                dispatchEvent: jest.fn(),
            };
            process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD = 'testpass';

            await expect(AuthService.signIn('cybergada@gmail.com', 'wrongpass')).rejects.toThrow('Email or password is incorrect');
        });

        it('throws on E2E sign in with unknown email', async () => {
            (globalThis as any).window = {
                location: { hostname: 'localhost', port: '19009' },
                localStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
                dispatchEvent: jest.fn(),
            };

            await expect(AuthService.signIn('unknown@test.com', '12345678')).rejects.toThrow('Email or password is incorrect');
        });

        it('accepts seeded Playwright role emails on the E2E port', async () => {
            const localStorageMock = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
            const dispatchEventMock = jest.fn();
            (globalThis as any).window = {
                location: { hostname: '127.0.0.1', port: '19009' },
                localStorage: localStorageMock,
                dispatchEvent: dispatchEventMock,
            };
            process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD = '12345678';

            const seededEmails = [
                'admin@agri-one.com',
                'expenses_encoder@agri-one.com',
                'mainoffice@agri-one.com',
            ];

            for (const email of seededEmails) {
                localStorageMock.setItem.mockClear();
                dispatchEventMock.mockClear();
                await AuthService.quickSignIn(email, '12345678');
                expect(localStorageMock.setItem).toHaveBeenCalledWith(
                    'jetfarm:e2e-auth-user',
                    expect.stringContaining(email)
                );
                expect(dispatchEventMock).toHaveBeenCalled();
            }
            expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
        });
    });

    describe('getUserBranchAndArea', () => {
        it('skips remote profile lookup on the E2E web port', async () => {
            (globalThis as any).window = {
                location: { hostname: '127.0.0.1', port: '19009' },
            };
            const fromSpy = jest.spyOn(supabase, 'from');

            await expect(AuthService.getUserBranchAndArea('master_collector')).resolves.toEqual({
                branchId: null,
                areaId: null,
            });
            expect(fromSpy).not.toHaveBeenCalled();
        });
    });

    describe('getUserBranchRoles', () => {
        it('returns empty array when uid is empty', async () => {
            const res = await AuthService.getUserBranchRoles('');
            expect(res).toEqual([]);
        });

        it('returns fallback branch role from user profile if no user_branch_roles exist', async () => {
            jest.spyOn(AuthService, 'getUserBranchAndArea').mockResolvedValueOnce({
                branchId: 'b-001',
                areaId: 'a-001',
            });
            jest.spyOn(AuthService, 'getCurrentUserRole').mockResolvedValueOnce('branch_manager');

            const res = await AuthService.getUserBranchRoles('user-123');
            expect(res).toEqual([
                {
                    branchId: 'b-001',
                    branchName: 'Current Branch',
                    role: 'branch_manager',
                },
            ]);
        });
    });

    describe('signOut', () => {
        it('preserves local db and signs out', async () => {
            await AuthService.signOut();
            expect(database.write).not.toHaveBeenCalled();
            expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
            expect(supabase.auth.signOut).toHaveBeenCalled();
        });

        it('throws if Supabase signOut returns an error', async () => {
            (supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({
                error: new Error('Sign out failed'),
            });

            await expect(AuthService.signOut()).rejects.toThrow('Sign out failed');
            expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
        });

        it('treats an already-missing auth session as signed out', async () => {
            const missingSessionError = Object.assign(new Error('Auth session missing!'), {
                name: 'AuthSessionMissingError',
            });
            (supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({
                error: missingSessionError,
            });

            await expect(AuthService.signOut()).resolves.toBeUndefined();
            expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
        });
    });

    describe('signOut - E2E (localhost:19009)', () => {
        it('removes localStorage item and dispatches event on E2E sign out', async () => {
            const localStorageMock = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
            const dispatchEventMock = jest.fn();
            (globalThis as any).window = {
                location: { hostname: 'localhost', port: '19009' },
                localStorage: localStorageMock,
                dispatchEvent: dispatchEventMock,
            };

            await AuthService.signOut();

            expect(localStorageMock.removeItem).toHaveBeenCalledWith('jetfarm:e2e-auth-user');
            expect(dispatchEventMock).toHaveBeenCalled();
            expect(supabase.auth.signOut).not.toHaveBeenCalled();
        });
    });

    describe('getCurrentUserRole', () => {
        it('uses Supabase as source of truth when remote role exists', async () => {
            mockAuthCollection.find.mockResolvedValue({ role: 'admin', deletedAt: null });
            mockAuthChain.maybeSingle.mockResolvedValue({ data: { role: 'collector', is_active: true, deleted_at: null }, error: null });
            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBe('collector');
        });

        it('does not fall back to local role when remote profile is missing', async () => {
            mockAuthCollection.find.mockResolvedValue({ role: 'admin', deletedAt: null });
            mockAuthChain.maybeSingle.mockResolvedValue({ data: null, error: null });
            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBeNull();
        });

        it('does not fall back to local role when remote profile is inactive', async () => {
            mockAuthCollection.find.mockResolvedValue({ role: 'admin', deletedAt: null });
            mockAuthChain.maybeSingle.mockResolvedValue({ data: { role: 'admin', is_active: false, deleted_at: null }, error: null });
            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBeNull();
        });

        it('does not fall back to local role when remote profile is deleted', async () => {
            mockAuthCollection.find.mockResolvedValue({ role: 'admin', deletedAt: null });
            mockAuthChain.maybeSingle.mockResolvedValue({ data: { role: 'admin', is_active: true, deleted_at: '2026-04-21' }, error: null });
            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBeNull();
        });

        it('returns from local db when remote lookup fails', async () => {
            mockAuthChain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Network unavailable' } });
            mockAuthCollection.find.mockResolvedValue({ role: 'admin', deletedAt: null });
            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBe('admin');
        });

        it('falls back safely after unauthorized remote lookup without clearing auth', async () => {
            const { clearPersistedAuthSession } = require('../../database/supabase');
            mockAuthChain.maybeSingle.mockResolvedValue({
                data: null,
                error: { message: 'permission denied for table user_profiles', status: 401 },
            });
            mockAuthCollection.find.mockResolvedValue({ role: 'admin', deletedAt: null });

            const role = await AuthService.getCurrentUserRole('u1');

            expect(role).toBeNull();
            expect(clearPersistedAuthSession).not.toHaveBeenCalled();
            expect(mockAuthCollection.find).not.toHaveBeenCalled();
        });

        it('treats permission denied without status as a non-fatal lookup failure', async () => {
            const { clearPersistedAuthSession } = require('../../database/supabase');
            mockAuthChain.maybeSingle.mockResolvedValue({
                data: null,
                error: { message: 'permission denied for table user_profiles' },
            });
            mockAuthCollection.find.mockResolvedValue({ role: 'admin', deletedAt: null });

            const role = await AuthService.getCurrentUserRole('u1');

            expect(role).toBeNull();
            expect(clearPersistedAuthSession).not.toHaveBeenCalled();
            expect(mockAuthCollection.find).not.toHaveBeenCalled();
        });

        it('falls back to local query if remote lookup and local find fail', async () => {
            mockAuthChain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Network unavailable' } });
            mockAuthCollection.find.mockRejectedValue(new Error('NotFound'));
            mockAuthCollection.fetch.mockResolvedValue([{ role: 'collector', deletedAt: null }]);
            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBe('collector');
        });

        it('falls back to Supabase if local fails', async () => {
            mockAuthCollection.find.mockRejectedValue(new Error('TotalFail'));
            mockAuthCollection.fetch.mockRejectedValue(new Error('TotalFail'));
            mockAuthChain.maybeSingle.mockResolvedValue({ data: { role: 'admin', is_active: true, deleted_at: null }, error: null });
            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBe('admin');
        });

        it('returns null if no profile exists in local or remote', async () => {
             mockAuthCollection.find.mockRejectedValue(new Error('F'));
             mockAuthCollection.fetch.mockResolvedValue([]);
             mockAuthChain.maybeSingle.mockResolvedValue({ data: null, error: null });
             const role = await AuthService.getCurrentUserRole('u1', 'unknown@email.com');
             expect(role).toBeNull();
        });

        it('returns null if uid is empty', async () => {
            const role = await AuthService.getCurrentUserRole('');
            expect(role).toBeNull();
        });

        it('handles remote error gracefully and returns null', async () => {
            mockAuthCollection.find.mockRejectedValue(new Error('Local Fail'));
            mockAuthCollection.fetch.mockResolvedValue([]);
            mockAuthChain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Remote Auth Fail' } });
            
            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBeNull();
        });

        it('falls back to local when remote query throws exception', async () => {
            mockAuthChain.maybeSingle.mockRejectedValue(new Error('Network crash'));
            mockAuthCollection.find.mockResolvedValue({ role: 'admin', deletedAt: null });

            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBe('admin');
        });

        it('handles local DB collection access error gracefully', async () => {
            // Remote check throws so we fall through to local DB, then database.get() fails
            mockAuthChain.maybeSingle.mockRejectedValue(new Error('Remote unavailable'));
            jest.spyOn(database, 'get').mockImplementationOnce(() => {
                throw new Error('DB access error');
            });

            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBeNull();
        });

        it('handles outer unexpected error via catch block', async () => {
            mockAuthChain.maybeSingle.mockRejectedValue(new Error('Unexpected'));
            jest.spyOn(database, 'get').mockImplementationOnce(() => {
                throw new Error('DB also fails');
            });

            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBeNull();
        });
    });

    describe('getCurrentUserRole - E2E (localhost:19009)', () => {
        it('returns role from E2E user when id matches', async () => {
            const localStorageMock = {
                getItem: jest.fn().mockReturnValue(JSON.stringify({
                    id: 'cybergada', email: 'cybergada@gmail.com', role: 'admin', full_name: 'Cybergada'
                })),
            };
            (globalThis as any).window = {
                location: { hostname: 'localhost', port: '19009' },
                localStorage: localStorageMock,
            };

            const role = await AuthService.getCurrentUserRole('cybergada');
            expect(role).toBe('admin');
        });

        it('returns role from E2E user when email matches', async () => {
            const localStorageMock = {
                getItem: jest.fn().mockReturnValue(JSON.stringify({
                    id: 'cybergada', email: 'cybergada@gmail.com', role: 'admin', full_name: 'Cybergada'
                })),
            };
            (globalThis as any).window = {
                location: { hostname: 'localhost', port: '19009' },
                localStorage: localStorageMock,
            };

            const role = await AuthService.getCurrentUserRole('different-id', 'cybergada@gmail.com');
            expect(role).toBe('admin');
        });

        it('returns null when E2E user id and email do not match', async () => {
            const localStorageMock = {
                getItem: jest.fn().mockReturnValue(JSON.stringify({
                    id: 'cybergada', email: 'cybergada@gmail.com', role: 'admin', full_name: 'Cybergada'
                })),
            };
            (globalThis as any).window = {
                location: { hostname: 'localhost', port: '19009' },
                localStorage: localStorageMock,
            };

            const role = await AuthService.getCurrentUserRole('other-id', 'other@email.com');
            expect(role).toBeNull();
        });
    });

    describe('getQuickLoginUsers', () => {
        it('returns no quick-login users when explicitly disabled', async () => {
            process.env.NODE_ENV = 'production';
            process.env.EXPO_PUBLIC_ENABLE_QUICK_LOGIN = 'false';

            const users = await AuthService.getQuickLoginUsers();
            expect(users).toEqual([]);
            expect(database.get).not.toHaveBeenCalled();
            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('filters and deduplicates users from local and remote', async () => {
            // Local
            mockAuthCollection.fetch.mockResolvedValueOnce([
                { id: '1', email: 'admin@agri-one.com', fullName: 'Real Admin', role: 'admin', isActive: true },
                { id: '2', email: 'mock@test.com', fullName: 'Mock User', role: 'expenses_encoder', isActive: true } // filtered by name and domain
            ]);
            // Remote
            (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null });
            mockAuthChain.then.mockImplementationOnce(function(this: any, resolve: any) {
                return Promise.resolve({
                    data: [
                        { id: '1', email: 'admin@agri-one.com', role: 'admin', is_active: true }, // Duplicate
                        { id: '3', email: 'real@gmail.com', role: 'main_office', is_active: true }
                    ],
                    error: null
                }).then(resolve);
            });

            const users = await AuthService.getQuickLoginUsers();
            expect(users.length).toBe(2);
            expect(users.map(u => u.email)).toContain('admin@agri-one.com');
            expect(users.map(u => u.email)).toContain('real@gmail.com');
        });

        it('handles errors in getQuickLoginUsers', async () => {
            mockAuthCollection.fetch.mockRejectedValue(new Error('Local Fail'));
            mockAuthChain.then.mockImplementationOnce(function(this: any, resolve: any) {
                return Promise.resolve({ data: null, error: { message: 'Rem Fail' } }).then(resolve);
            });
            const users = await AuthService.getQuickLoginUsers();
            expect(users).toEqual([]);
        });

        it('returns empty array when remote profiles fetch has error with authenticated session', async () => {
            process.env.NODE_ENV = 'development';
            delete process.env.EXPO_PUBLIC_ENABLE_QUICK_LOGIN;
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null });
            mockAuthCollection.fetch.mockResolvedValue([]);
            mockAuthChain.then.mockImplementationOnce(function(this: any, resolve: any) {
                return Promise.resolve({ data: null, error: { message: 'Remote fetch failed' } }).then(resolve);
            });

            const users = await AuthService.getQuickLoginUsers();
            expect(users).toEqual([]);
        });

        it('returns local users only when no authenticated session', async () => {
            process.env.NODE_ENV = 'development';
            delete process.env.EXPO_PUBLIC_ENABLE_QUICK_LOGIN;
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
            mockAuthCollection.fetch.mockResolvedValue([
                { id: '1', email: 'admin@agri-one.com', fullName: 'Real Admin', role: 'admin', isActive: true },
            ]);

            const users = await AuthService.getQuickLoginUsers();
            expect(users.length).toBe(1);
            expect(users[0].email).toBe('admin@agri-one.com');
            // Should not call supabase.from for remote profiles
            expect(supabase.auth.getSession).toHaveBeenCalled();
        });
    });

    describe('sendPasswordResetEmail', () => {
        it('sends password reset email successfully', async () => {
            (supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({ error: null });

            await AuthService.sendPasswordResetEmail('test@example.com');
            expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com');
        });

        it('throws error when password reset fails', async () => {
            const resetError = new Error('Reset failed');
            (supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({ error: resetError });

            await expect(AuthService.sendPasswordResetEmail('test@example.com')).rejects.toThrow('Reset failed');
        });

        it('handles network error in password reset via ErrorService', async () => {
            const networkError = new Error('Failed to fetch');
            // Make resetPasswordForEmail throw directly (not return error object)
            (supabase.auth.resetPasswordForEmail as jest.Mock).mockRejectedValue(networkError);

            await expect(AuthService.sendPasswordResetEmail('test@example.com')).rejects.toThrow('Failed to fetch');
        });

        it('trims email before sending reset', async () => {
            (supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({ error: null });

            await AuthService.sendPasswordResetEmail('  test@example.com  ');
            expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com');
        });
    });

    describe('Accessors and Error Handling', () => {
        it('gets currentUser and ID', async () => {
            (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'u123' } } });
            await AuthService.getCurrentUserId();
            expect(AuthService.currentUser).toBeDefined();
        });

        it('handles error in getCurrentUserRole', async () => {
            (supabase.auth.getUser as jest.Mock).mockRejectedValueOnce(new Error('Auth Fail'));
            const res = await AuthService.getCurrentUserRole('u1');
            expect(res).toBeNull();
        });

        it('returns null for unknown email', async () => {
            const res = await AuthService.getCurrentUserRole('unknown@email.com');
            expect(res).toBeNull();
        });
    });

    describe('Edge cases for uncovered lines', () => {
        it('handles corrupted localStorage JSON in readE2EUser gracefully', async () => {
            // Corrupted JSON triggers the catch block (line 38) in readE2EUser
            (globalThis as any).window = {
                location: { hostname: 'localhost', port: '19009' },
                localStorage: {
                    getItem: jest.fn().mockReturnValue('{invalid json!!!!'),
                },
            };

            // readE2EUser returns null because JSON.parse throws -> catch returns null
            // getCurrentUserRole then falls through to normal lookup
            mockAuthChain.maybeSingle.mockResolvedValue({ data: null, error: null });
            mockAuthCollection.find.mockRejectedValue(new Error('not found'));
            mockAuthCollection.fetch.mockResolvedValue([]);

            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBeNull();
        });

        it('handles database.collections accessor throwing in getCurrentUserRole', async () => {
            // Force the outer catch (lines 219-221) by making database.collections throw on access
            mockAuthChain.maybeSingle.mockRejectedValue(new Error('Remote fail'));
            Object.defineProperty(database, 'collections', {
                get: () => { throw new Error('collections accessor crash'); },
                configurable: true,
            });

            const role = await AuthService.getCurrentUserRole('u1');
            expect(role).toBeNull();
        });
    });
});


