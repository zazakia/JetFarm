import { supabase } from '../database/supabase';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import UserProfile from '../database/models/UserProfile';
import { ErrorService, ErrorType } from './ErrorService';
import { isLocalWebE2E } from '../utils/e2eEnvironment';

console.log('[AuthService] Module loaded V3');

const E2E_AUTH_STORAGE_KEY = 'jetfarm:e2e-auth-user';
// Keep in sync with supabase/seed.sql login users + login quick-access aliases.
const E2E_TEST_USERS: Record<string, { id: string; role: string; full_name: string }> = {
    'cybergada@gmail.com': { id: 'cybergada', role: 'admin', full_name: 'Click here to Login sir Jet' },
    'admin@jetfarm.com': { id: 'admin', role: 'admin', full_name: 'Admin User' },
    'collector@jetfarm.com': { id: 'master_collector', role: 'collector', full_name: 'Master Collector' },
    // Alias used by login quick-access UI; seed canonical is loan_encoder@...
    'encoder@jetfarm.com': { id: 'loan_encoder', role: 'loan_encoder', full_name: 'Loan Encoder' },
    'loan_encoder@jetfarm.com': { id: 'loan_encoder', role: 'loan_encoder', full_name: 'Loan Encoder' },
    'payment_encoder@jetfarm.com': { id: 'payment_encoder', role: 'payment_encoder', full_name: 'Payment Encoder' },
    'expenses_encoder@jetfarm.com': { id: 'expenses_encoder', role: 'expenses_encoder', full_name: 'Expenses Encoder' },
    'cresencio.junco@jetfarm.com': { id: 'cresencio', role: 'collector', full_name: 'Cresencio Junco' },
    'gerald.gera@jetfarm.com': { id: 'gerald', role: 'collector', full_name: 'Gerald Gera' },
    'bernie.casera@jetfarm.com': { id: 'bernie', role: 'collector', full_name: 'Bernie Casera' },
    'member.test@jetfarm.com': { id: 'test_member', role: 'borrower', full_name: 'Test Member' },
};

const readE2EUser = () => {
    if (!isLocalWebE2E()) return null;

    try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(E2E_AUTH_STORAGE_KEY) : null;
        return raw ? JSON.parse(raw) as { id: string; email: string; role: string; full_name: string } : null;
    } catch {
        return null;
    }
};

export class AuthService {
    static isQuickLoginEnabled(): boolean {
        const explicitSetting = process.env.EXPO_PUBLIC_ENABLE_QUICK_LOGIN?.trim().toLowerCase();

        if (explicitSetting === 'false') {
            return false;
        }

        return true;
    }

    /**
     * Quick sign-in for hardcoded test users. Production project hosts must use
     * real Supabase auth so sync has an authenticated remote session.
     */
    static async quickSignIn(email: string, password: string): Promise<void> {
        const normalizedEmail = email.trim().toLowerCase();
        const user = E2E_TEST_USERS[normalizedEmail];
        const expectedPassword = process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD || '12345678';
        if (!user || password.trim() !== expectedPassword) {
            if (isLocalWebE2E()) {
                throw new Error('Email or password is incorrect');
            }
            // Fall through to real Supabase auth for non-E2E users
            return AuthService.signIn(email, password);
        }
        if (!isLocalWebE2E()) {
            return AuthService.signIn(email, password);
        }
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(E2E_AUTH_STORAGE_KEY, JSON.stringify({
                ...user,
                email: normalizedEmail,
            }));
            window.dispatchEvent(new CustomEvent('jetfarm:e2e-auth-changed'));
        }
    }

    static async signIn(email: string, password: string): Promise<void> {
        console.log(`[AuthService] Attempting signIn for: ${email}`);
        if (isLocalWebE2E()) {
            const normalizedEmail = email.trim().toLowerCase();
            const user = E2E_TEST_USERS[normalizedEmail];
            const expectedPassword = process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD || '12345678';
            if (!user || password.trim() !== expectedPassword) {
                throw new Error('Email or password is incorrect');
            }
            window.localStorage.setItem(E2E_AUTH_STORAGE_KEY, JSON.stringify({
                ...user,
                email: normalizedEmail,
            }));
            window.dispatchEvent(new CustomEvent('jetfarm:e2e-auth-changed'));
            return;
        }
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password.trim(),
            });

            if (error) {
                ErrorService.handleError(new Error(`[AuthService] Supabase signIn error details: ${error.message} [Status: ${(error as any).status}]`), `[AuthService] Supabase signIn error details: ${error.message} [Status: ${(error as any).status}]`);
                throw error;
            }

            console.log('[AuthService] signIn successful for user ID:', data?.user?.id);

            if (data?.user?.id) {
                let { data: profile, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('id, role, is_active, deleted_at')
                    .eq('id', data.user.id)
                    .maybeSingle();

                if (!profile && email) {
                    const { data: profileByEmail } = await supabase
                        .from('user_profiles')
                        .select('id, role, is_active, deleted_at')
                        .ilike('email', email.trim().toLowerCase())
                        .maybeSingle();

                    if (profileByEmail) {
                        profile = profileByEmail;
                        try {
                            await supabase.from('user_profiles').update({ id: data.user.id }).eq('id', profileByEmail.id);
                        } catch (linkErr) {
                            console.warn('[AuthService] Linking profile ID on login failed:', linkErr);
                        }
                    }
                }

                if (profileError) {
                    console.warn('[AuthService] Profile approval check failed after signIn:', profileError.message);
                } else if (profile && (profile.deleted_at || profile.is_active === false || !profile.role)) {
                    await supabase.auth.signOut();
                    throw new Error('Account pending admin approval. Please wait for an administrator to verify and approve your account.');
                }
            }
        } catch (error) {
            ErrorService.handleError(error, '[AuthService] error in signIn:');
            throw ErrorService.handleError(error, 'AuthService.signIn', ErrorType.AUTH);
        }
    }

    static async signOut(): Promise<void> {
        // Clear any local E2E session before remote sign-out.
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.removeItem(E2E_AUTH_STORAGE_KEY);
                window.dispatchEvent(new CustomEvent('jetfarm:e2e-auth-changed'));
            } catch {}
        }

        // In pure E2E mode (not our production quick login), skip Supabase signOut
        if (isLocalWebE2E()) return;

        const { error } = await supabase.auth.signOut();
        if (error) {
            const message = (error.message || '').toLowerCase();
            const name = (error.name || '').toLowerCase();
            if (
                name.includes('authsessionmissing') ||
                message.includes('auth session missing') ||
                message.includes('session missing') ||
                message.includes('session_not_found') ||
                (error as any).status === 403
            ) {
                console.warn('[AuthService] Sign out skipped because the auth session is already missing or expired.');
                return;
            }
            throw error;
        }
    }

    static async getCurrentUserRole(uid: string, email?: string): Promise<string | null> {
        const e2eUser = readE2EUser();
        if (e2eUser && (e2eUser.id === uid || e2eUser.email === email?.toLowerCase())) {
            return e2eUser.role;
        }

        if (!uid) {
            console.log('[AuthService] getCurrentUserRole called with no UID');
            return null;
        }

        console.log(`[AuthService] Resolving role for ${email || uid}...`);

        try {
            // Supabase is the source of truth for authorization while online.
            try {
                let { data, error } = await supabase
                    .from('user_profiles')
                    .select('id, role, is_active, deleted_at')
                    .eq('id', uid)
                    .maybeSingle();

                if (!data && email) {
                    const { data: dataByEmail } = await supabase
                        .from('user_profiles')
                        .select('id, role, is_active, deleted_at')
                        .ilike('email', email.trim().toLowerCase())
                        .maybeSingle();

                    if (dataByEmail) {
                        data = dataByEmail;
                        try {
                            await supabase.from('user_profiles').update({ id: uid }).eq('id', dataByEmail.id);
                        } catch {}
                    }
                }

                if (error) {
                    console.warn(`[AuthService] Remote role lookup failed for ${uid}:`, error.message);
                    const status = (error as any).status;
                    const message = (error.message || '').toLowerCase();
                    const isAuthorizationFailure =
                        status === 401 ||
                        status === 403 ||
                        message.includes('permission denied') ||
                        message.includes('jwt') ||
                        message.includes('unauthorized');

                    if (isAuthorizationFailure) {
                        console.warn('[AuthService] Unauthorized role lookup detected. Keeping auth session and falling back.');
                        return null;
                    }
                } else if (!data) {
                    console.warn(`[AuthService] No active remote profile found for UID ${uid}.`);
                    return null;
                } else if (data.deleted_at || data.is_active === false || !data.role) {
                    console.warn(`[AuthService] Remote profile for UID ${uid} is inactive, deleted, or missing a role.`);
                    return null;
                } else {
                    console.log(`[AuthService] Found remote role for ${uid}: ${data.role}`);
                    return data.role;
                }
            } catch (remoteErr) {
                console.warn('[AuthService] Remote role check failed or skipped:', remoteErr instanceof Error ? remoteErr.message : String(remoteErr));
            }

            // Local WatermelonDB is only a fallback cache when remote role is unavailable.
            if (database && database.collections) {
                try {
                    const profilesCollection = database.get<UserProfile>('user_profiles');
                    if (profilesCollection) {
                        try {
                            const profile = await profilesCollection.find(uid);
                            if (profile && !profile.deletedAt) {
                                console.log(`[AuthService] Found local role for ${uid}: ${profile.role}`);
                                return profile.role;
                            }
                        } catch (e) {
                            // find() throws if not found, try query as fallback
                            const allProfiles = await profilesCollection.query(Q.where('id', uid)).fetch();
                            if (allProfiles.length > 0 && !allProfiles[0].deletedAt) {
                                console.log(`[AuthService] Found local role via query for ${uid}: ${allProfiles[0].role}`);
                                return allProfiles[0].role;
                            }
                        }
                    }
                } catch (dbErr) {
                    console.log('[AuthService] Local DB check failed or skipped:', dbErr instanceof Error ? dbErr.message : String(dbErr));
                }
            }

            console.warn(`[AuthService] No role found for UID ${uid} in any source.`);
            return null;
        } catch (e) {
            ErrorService.handleError(e, '[AuthService] Error in getCurrentUserRole:');
            ErrorService.handleError(e, 'AuthService.getCurrentUserRole', ErrorType.AUTH);
            return null;
        }
    }

    static async resolveCollectorId(uid: string): Promise<string | null> {
        const e2eUser = readE2EUser();
        if (e2eUser?.id === uid && e2eUser.role === 'collector') {
            return `collector-${uid}`;
        }

        if (!uid) return null;
        try {
            const collectorRecords = await database.collections.get<any>('collectors')
                .query(Q.where('auth_id', uid))
                .fetch();

            if (collectorRecords.length > 0) {
                return collectorRecords[0].id;
            }

            console.log(`[AuthService] Collector not found locally for UID: ${uid}, checking remote...`);
            const { data, error } = await supabase
                .from('app_collectors')
                .select('id')
                .eq('auth_id', uid)
                .is('deleted_at', null)
                .maybeSingle();

            if (error) {
                console.warn('[AuthService] Remote collector lookup failed:', error.message);
                return null;
            }

            if (data?.id) {
                return data.id;
            }

            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('full_name, role, is_active, deleted_at')
                .eq('id', uid)
                .maybeSingle();

            if (profileError) {
                console.warn('[AuthService] Remote collector profile lookup failed:', profileError.message);
                return null;
            }

            if (!profile || profile.role !== 'collector' || profile.is_active === false || profile.deleted_at || !profile.full_name) {
                return null;
            }

            const { data: namedCollector, error: namedCollectorError } = await supabase
                .from('app_collectors')
                .select('id')
                .eq('full_name', profile.full_name)
                .is('deleted_at', null)
                .maybeSingle();

            if (namedCollectorError) {
                console.warn('[AuthService] Remote named collector lookup failed:', namedCollectorError.message);
                return null;
            }

            return namedCollector?.id || null;
        } catch (e) {
            ErrorService.handleError(e, '[AuthService] Error resolving collector ID:');
            return null;
        }
    }

    static async getQuickLoginUsers() {
        if (!AuthService.isQuickLoginEnabled()) {
            return [];
        }

        try {
            const usersMap = new Map<string, any>();

            if (database && database.collections) {
                try {
                    const localProfiles = await database.get<UserProfile>('user_profiles').query(
                        Q.where('role', Q.oneOf(['admin', 'collector', 'loan_encoder', 'payment_encoder', 'expenses_encoder'])),
                        Q.where('is_active', true)
                    ).fetch();
                    localProfiles.forEach(p => {
                        const email = (p.email || '').toLowerCase();
                        const name = (p.fullName || '').toLowerCase();
                        const isAllowedDomain = email.endsWith('@jetfarm.com') || email.endsWith('@gmail.com');
                        const isMockName = name.includes('diagnostic') || name.includes('mock') || name.includes('test') || name.includes('fix') || name.includes('collector 0') || name.includes('collector 1');
                        
                        const isE2E = process.env.NODE_ENV === 'test'
                            ? (isAllowedDomain && !isMockName)
                            : E2E_TEST_USERS[email] !== undefined;

                        if (email && isE2E) {
                            usersMap.set(email, {
                                id: p.id,
                                full_name: p.fullName,
                                role: p.role,
                                email: p.email,
                                is_active: p.isActive
                            });
                        }
                    });
                } catch (dbErr) {
                    console.log('[AuthService] Local profiles fetch failed/skipped', dbErr);
                }
            }

            const { data: sessionData } = await supabase.auth.getSession();
            const hasAuthenticatedSession = Boolean(sessionData?.session?.access_token);

            if (!hasAuthenticatedSession) {
                return Array.from(usersMap.values());
            }

            const { data: remoteProfiles, error } = await supabase
                .from('user_profiles')
                .select('id, full_name, role, email, is_active')
                .eq('is_active', true)
                .order('role');

            if (error) {
                throw error;
            }

            if (remoteProfiles) {
                remoteProfiles.forEach(p => {
                    const email = (p.email || '').toLowerCase();
                    const role = p.role || 'collector';
                    const name = (p.full_name || '').toLowerCase();
                    const isAllowedDomain = email.endsWith('@jetfarm.com') || email.endsWith('@gmail.com');
                    const isMockName = name.includes('diagnostic') || name.includes('mock') || name.includes('test') || name.includes('fix') || name.includes('collector 0') || name.includes('collector 1');

                    const isE2E = process.env.NODE_ENV === 'test'
                        ? ((role === 'admin' || role === 'collector' || role === 'loan_encoder' || role === 'payment_encoder' || role === 'expenses_encoder' || role === 'borrower') && isAllowedDomain && !isMockName)
                        : E2E_TEST_USERS[email] !== undefined;

                    if (email && !usersMap.has(email) && isE2E) {
                        usersMap.set(email, {
                            id: p.id,
                            full_name: p.full_name || 'Unknown User',
                            role: role,
                            email: p.email,
                            is_active: p.is_active ?? true
                        });
                    }
                });
            }

            return Array.from(usersMap.values());
        } catch (error) {
            ErrorService.handleError(error, 'AuthService.getQuickLoginUsers', ErrorType.AUTH);
            return [];
        }
    }

    static get currentUser() {
        return supabase.auth.getUser();
    }

    static async getCurrentUserId(): Promise<string | null> {
        const { data } = await supabase.auth.getUser();
        return data.user?.id || null;
    }

    static async sendPasswordResetEmail(email: string): Promise<void> {
        console.log(`[AuthService] Sending password reset email to: ${email}`);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
            if (error) {
                ErrorService.handleError(new Error(`[AuthService] resetPasswordForEmail error: ${error.message}`), `[AuthService] resetPasswordForEmail error: ${error.message}`);
                throw error;
            }
            console.log('[AuthService] Password reset email sent successfully.');
        } catch (error) {
            ErrorService.handleError(error, '[AuthService] error in sendPasswordResetEmail:');
            throw ErrorService.handleError(error, 'AuthService.sendPasswordResetEmail', ErrorType.AUTH);
        }
    }

    static async getUserBranchAndArea(uid: string): Promise<{ branchId: string | null; areaId: string | null }> {
        if (!uid) return { branchId: null, areaId: null };
        // Guard against seed/test nil UUIDs (00000000-...) that cause 400s on Supabase
        const NIL_UUID_PREFIX = '00000000-0000-0000-0000-';
        if (uid.startsWith(NIL_UUID_PREFIX)) return { branchId: null, areaId: null };
        // E2E mock auth has no remote profile rows; skip schema-dependent REST calls.
        if (isLocalWebE2E()) {
            return { branchId: null, areaId: null };
        }
        try {
            if (database && database.collections) {
                try {
                    const profilesCollection = database.get<UserProfile>('user_profiles');
                    if (profilesCollection) {
                        const profile = await profilesCollection.find(uid);
                        if (profile && !profile.deletedAt) {
                            return {
                                branchId: profile.branchId ?? null,
                                areaId: profile.areaId ?? null,
                            };
                        }
                    }
                } catch {}
            }

            const { data, error } = await supabase
                .from('user_profiles')
                .select('branch_id, area_id')
                .eq('id', uid)
                .maybeSingle();

            if (error) {
                console.warn('[AuthService] getUserBranchAndArea remote lookup failed:', error.message);
                return { branchId: null, areaId: null };
            }

            if (data) {
                return {
                    branchId: data.branch_id ?? null,
                    areaId: data.area_id ?? null,
                };
            }
        } catch (e) {
            console.warn('[AuthService] Error in getUserBranchAndArea:', e);
        }
        return { branchId: null, areaId: null };
    }

    static async getUserBranchRoles(uid: string): Promise<Array<{ branchId: string; branchName?: string; role: string }>> {
        if (!uid) return [];
        const results: Array<{ branchId: string; branchName?: string; role: string }> = [];

        try {
            if (database && database.collections) {
                try {
                    const ubrCollection = database.get<any>('user_branch_roles');
                    if (ubrCollection) {
                        const localUbrs = await ubrCollection.query(
                            Q.where('user_id', uid),
                            Q.where('deleted_at', null)
                        ).fetch();

                        if (localUbrs && localUbrs.length > 0) {
                            for (const ubr of localUbrs) {
                                let bName: string | undefined;
                                try {
                                    const branch = await database.get<any>('branches').find(ubr.branchId);
                                    bName = branch?.name;
                                } catch {}
                                results.push({
                                    branchId: ubr.branchId,
                                    branchName: bName || `Branch ${ubr.branchId.slice(0, 8)}`,
                                    role: ubr.role,
                                });
                            }
                            return results;
                        }
                    }
                } catch {}
            }

            // Remote Supabase fallback
            if (!isLocalWebE2E()) {
                const { data: remoteUbrs, error } = await supabase
                    .from('user_branch_roles')
                    .select('branch_id, role, branches(name)')
                    .eq('user_id', uid)
                    .is('deleted_at', null);

                if (!error && remoteUbrs && remoteUbrs.length > 0) {
                    return remoteUbrs.map((r: any) => ({
                        branchId: r.branch_id,
                        branchName: r.branches?.name || `Branch ${r.branch_id?.slice(0, 8)}`,
                        role: r.role,
                    }));
                }
            }

            // Legacy fallback to user_profiles (branch_id + role)
            const branchAndArea = await AuthService.getUserBranchAndArea(uid);
            const role = await AuthService.getCurrentUserRole(uid);
            if (branchAndArea.branchId && role) {
                return [{
                    branchId: branchAndArea.branchId,
                    branchName: 'Current Branch',
                    role,
                }];
            }
        } catch (e) {
            console.warn('[AuthService] Error in getUserBranchRoles:', e);
        }
        return results;
    }
}

