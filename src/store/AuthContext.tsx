import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { clearPersistedAuthSession, supabase, withTimeout } from '../database/supabase';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { AuthService } from '../services/AuthService';
import { ROLE_HOME_ROUTES, UserRole } from '../constants/roles';
import { ErrorService, ErrorType } from '../services/ErrorService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildRouteWithGroup, isRouteAllowedForRole, LAST_AUTHORIZED_ROUTE_KEY } from '../utils/authNavigation';
import { isLocalWebE2E } from '../utils/e2eEnvironment';

export type BranchRoleAssignment = {
    branchId: string;
    branchName?: string;
    role: string;
};

type AuthContextType = {
    user: User | null;
    session: Session | null;
    role: string | null;
    roleResolved: boolean;
    branchId: string | null;
    areaId: string | null;
    userBranchRoles: BranchRoleAssignment[];
    switchBranchContext: (branchId: string, targetRole?: string) => Promise<void>;
    sunlightMode: boolean;
    toggleSunlightMode: () => void;
    initialized: boolean;
    initializationError: Error | null;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    role: null,
    roleResolved: false,
    branchId: null,
    areaId: null,
    userBranchRoles: [],
    switchBranchContext: async () => { },
    sunlightMode: false,
    toggleSunlightMode: () => { },
    initialized: false,
    initializationError: null,
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);
export const SKIP_NEXT_AUTO_SYNC_KEY = 'skip_next_auto_sync_once';

const SESSION_RESTORE_TIMEOUT_MS = 15000;
const ROLE_RESOLUTION_TIMEOUT_MS = 15000;
const E2E_AUTH_STORAGE_KEY = 'jetfarm:e2e-auth-user';

const readE2ESession = (): Session | null => {
    if (!isLocalWebE2E()) return null;

    try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(E2E_AUTH_STORAGE_KEY) : null;
        if (!raw) return null;
        const mockUser = JSON.parse(raw) as { id: string; email: string };
        return {
            access_token: `e2e-access-${mockUser.id}`,
            refresh_token: `e2e-refresh-${mockUser.id}`,
            expires_in: 3600,
            token_type: 'bearer',
            user: {
                id: mockUser.id,
                email: mockUser.email,
                app_metadata: {},
                user_metadata: {},
                aud: 'authenticated',
                created_at: new Date(0).toISOString(),
            },
        } as Session;
    } catch {
        return null;
    }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [roleResolved, setRoleResolved] = useState(false);
    const [branchId, setBranchId] = useState<string | null>(null);
    const [areaId, setAreaId] = useState<string | null>(null);
    const [userBranchRoles, setUserBranchRoles] = useState<BranchRoleAssignment[]>([]);
    const [sunlightMode, setSunlightMode] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [initializationError, setInitializationError] = useState<Error | null>(null);

    const switchBranchContext = async (targetBranchId: string, targetRole?: string) => {
        try {
            await AsyncStorage.setItem('active_branch_context', targetBranchId);
            setBranchId(targetBranchId);
            const matchingRole = targetRole || userBranchRoles.find(ubr => ubr.branchId === targetBranchId)?.role;
            if (matchingRole) {
                setRole(matchingRole as UserRole);
                const homeRoute = ROLE_HOME_ROUTES[matchingRole as UserRole] ?? '/(admin)/agribusiness';
                router.replace(homeRoute as any);
            }
        } catch (e) {
            console.warn('[AuthContext] Error switching branch context:', e);
        }
    };
    const suppressNextAutoSyncRef = useRef(false);
    const isBootstrappingRef = useRef(true);
    const roleResolutionRequestIdRef = useRef(0);
    const roleResolutionPromiseRef = useRef<Promise<void> | null>(null);
    const roleResolutionUserIdRef = useRef<string | null>(null);
    const currentUserIdRef = useRef<string | null>(null);
    const currentRoleResolvedRef = useRef(false);

    const segments = useSegments();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        currentUserIdRef.current = user?.id ?? null;
        currentRoleResolvedRef.current = roleResolved;
    }, [user?.id, roleResolved]);

    useEffect(() => {
        if (!initialized || !user || !roleResolved || !role) return;

        const currentRoute = buildRouteWithGroup(segments[0], pathname);
        if (!isRouteAllowedForRole(currentRoute, role)) return;

        Promise.resolve(AsyncStorage.setItem(LAST_AUTHORIZED_ROUTE_KEY, currentRoute)).catch((error) => {
            console.warn('[AuthContext] Failed to persist last authorized route:', error);
        });
    }, [initialized, user, role, roleResolved, segments, pathname]);

    const resolveRoleForSession = async (
        sessionUser: User,
        source: string,
        _shouldSkipAutoSync: boolean,
        preserveResolvedState = false
    ) => {
        if (roleResolutionPromiseRef.current && roleResolutionUserIdRef.current === sessionUser.id) {
            return roleResolutionPromiseRef.current;
        }

        const roleRequestId = ++roleResolutionRequestIdRef.current;
        roleResolutionUserIdRef.current = sessionUser.id;
        if (!preserveResolvedState) {
            setRoleResolved(false);
        }

        let settlePromise: Promise<void>;
        settlePromise = (async () => {
            let resolvedRole: string | null = null;

            for (let attempt = 1; attempt <= 2; attempt++) {
                resolvedRole = await withTimeout(
                    AuthService.getCurrentUserRole(sessionUser.id, sessionUser.email),
                    ROLE_RESOLUTION_TIMEOUT_MS,
                    `${source} role resolution`
                );
                if (resolvedRole || attempt === 2) {
                    break;
                }

                console.log(`[AuthContext] ${source} role resolution returned no role, retrying once...`);
                await new Promise((resolve) => setTimeout(resolve, 500));
                if (roleRequestId !== roleResolutionRequestIdRef.current) return;
            }

            if (roleRequestId !== roleResolutionRequestIdRef.current) return;
            console.log(`[AuthContext] Resolved role: ${resolvedRole}`);
            if (!resolvedRole) {
                setInitializationError(new Error('No active profile found. Please ask an administrator to approve your account.'));
            } else {
                setInitializationError(null);
            }
            setRole(resolvedRole as UserRole);

            try {
                const branchAndArea = await AuthService.getUserBranchAndArea(sessionUser.id);
                const ubrList = await AuthService.getUserBranchRoles(sessionUser.id);
                if (roleRequestId === roleResolutionRequestIdRef.current) {
                    setUserBranchRoles(ubrList);
                    const savedBranchContext = await AsyncStorage.getItem('active_branch_context');
                    if (savedBranchContext && ubrList.some(ubr => ubr.branchId === savedBranchContext)) {
                        setBranchId(savedBranchContext);
                        const savedRole = ubrList.find(ubr => ubr.branchId === savedBranchContext)?.role;
                        if (savedRole) {
                            setRole(savedRole as UserRole);
                        }
                    } else if (ubrList.length > 0) {
                        setBranchId(ubrList[0].branchId);
                        if (!resolvedRole && ubrList[0].role) {
                            setRole(ubrList[0].role as UserRole);
                        }
                    } else {
                        setBranchId(branchAndArea.branchId);
                    }
                    setAreaId(branchAndArea.areaId);
                }
            } catch (err) {
                console.warn('[AuthContext] Error resolving branch/area/roles:', err);
            }
        })()
            .catch((roleError) => {
                if (roleRequestId !== roleResolutionRequestIdRef.current) return;
                console.error('[AuthContext] Role/Collector ID fetch error:', roleError);
                setInitializationError(new Error('Unable to verify your access. Please check your connection and try again.'));
                setRole(null);
                setBranchId(null);
                setAreaId(null);
            })
            .finally(() => {
                if (roleRequestId === roleResolutionRequestIdRef.current) {
                    setRoleResolved(true);
                }
                if (roleResolutionPromiseRef.current === settlePromise) {
                    roleResolutionPromiseRef.current = null;
                    roleResolutionUserIdRef.current = null;
                }
            });

        roleResolutionPromiseRef.current = settlePromise;
        return settlePromise;
    };

    useEffect(() => {
        const loadSunlightMode = async () => {
            try {
                const savedMode = await AsyncStorage.getItem('sunlight_mode');
                if (savedMode !== null) {
                    setSunlightMode(savedMode === 'true');
                }
            } catch (e) {
                console.error('[AuthContext] Error loading sunlight mode:', e);
            }
        };
        loadSunlightMode();

        const consumeSkipNextAutoSync = async () => {
            try {
                const shouldSkip = await AsyncStorage.getItem(SKIP_NEXT_AUTO_SYNC_KEY);
                if (shouldSkip === 'true') {
                    await AsyncStorage.removeItem(SKIP_NEXT_AUTO_SYNC_KEY);
                    suppressNextAutoSyncRef.current = true;
                    return true;
                }
            } catch (e) {
                console.warn('[AuthContext] Failed to read one-shot auto-sync suppression flag:', e);
            }
            suppressNextAutoSyncRef.current = false;
            return false;
        };

        const checkSession = async () => {
            try {
                setInitializationError(null);
                const bootstrapRequestId = roleResolutionRequestIdRef.current;

                let sessionResult: { data: { session: Session | null }; error: any };
                const e2eSession = readE2ESession();
                if (e2eSession) {
                    sessionResult = { data: { session: e2eSession }, error: null };
                } else {
                    try {
                        sessionResult = await withTimeout(
                            supabase.auth.getSession(),
                            SESSION_RESTORE_TIMEOUT_MS,
                            'Session restore'
                        );
                    } catch (timeoutErr) {
                        const timeoutMessage = String((timeoutErr as any)?.message ?? '').toLowerCase();
                        if (!timeoutMessage.includes('timed out')) {
                            throw timeoutErr;
                        }

                        console.warn('[AuthContext] Session restore timed out, attempting refresh...');
                        try {
                            const { data, error: refreshError } = await supabase.auth.refreshSession();
                            if (refreshError) throw refreshError;
                            sessionResult = { data: { session: data.session }, error: null };
                        } catch {
                            throw timeoutErr;
                        }
                    }
                }

                const { data: { session }, error } = sessionResult;
                if (error) throw error;
                if (bootstrapRequestId !== roleResolutionRequestIdRef.current) return;

                console.log('[AuthContext] Session fetched');
                setSession(session);
                if (session?.user) {
                    console.log('[AuthContext] Session changed');
                    setUser(session.user); // Set user first
                    const skipInitialSync = await consumeSkipNextAutoSync();
                    if (skipInitialSync) {
                        console.log('[AuthContext] Skipping one auto-sync after local database reset');
                    }
                    void resolveRoleForSession(session.user, 'Initial', skipInitialSync);
                } else {
                    console.log('[AuthContext] Session cleared');
                    roleResolutionRequestIdRef.current++;
                    roleResolutionPromiseRef.current = null;
                    roleResolutionUserIdRef.current = null;
                    setUser(null);
                    setRole(null);
                    setRoleResolved(true);
                }
            } catch (err: any) {
                // If it's a refresh token error or invalid session, clear everything to allow a clean login
                // We check for various formats of the "Invalid Refresh Token" error returned by Supabase
                const errorMessage = (err?.message || '').toLowerCase();
                const errorCode = (err?.code || '').toLowerCase();
                const errorStatus = err?.status || (err?.originalError?.status);

                const isRefreshTokenError = 
                    errorMessage.includes('refresh token') || 
                    errorMessage.includes('invalid_grant') ||
                    errorCode.includes('refresh_token_not_found') ||
                    errorCode.includes('invalid_grant') ||
                    errorStatus === 400;

                const isAuthApiError = err?.name === 'AuthApiError' || err?.__isAuthError;

                if (isRefreshTokenError || isAuthApiError) {
                    console.log('[AuthContext] Session initialization refresh token/auth error (handled):', err?.message || err);
                } else {
                    console.error('[AuthContext] Session initialization error:', err);
                }

                setInitializationError(err instanceof Error ? err : new Error(String(err?.message ?? err)));

                if (isRefreshTokenError || isAuthApiError) {
                    console.log('[AuthContext] Stale/Invalid session detected (400/AuthApiError), clearing storage...');
                    try {
                        await clearPersistedAuthSession();
                    } catch (clearErr) {
                        console.warn('[AuthContext] Failed to clear persisted auth session during recovery', clearErr);
                    }
                    setSession(null);
                    setUser(null);
                    setRole(null);
                    setRoleResolved(true);
                } else {
                    ErrorService.handleError(err, 'AuthContext.getSession', ErrorType.AUTH);
                }
            } finally {
                isBootstrappingRef.current = false;
                setInitialized(true);
            }
        };

        checkSession();

        const handleE2EAuthChanged = () => {
            const e2eSession = readE2ESession();
            if (!e2eSession?.user) {
                roleResolutionRequestIdRef.current++;
                setInitializationError(null);
                setSession(null);
                setUser(null);
                setRole(null);
                setRoleResolved(true);
                return;
            }

            setInitializationError(null);
            setSession(e2eSession);
            setUser(e2eSession.user);
            void resolveRoleForSession(e2eSession.user, 'E2E', true);
        };

        if (isLocalWebE2E() && typeof window.addEventListener === 'function') {
            window.addEventListener('jetfarm:e2e-auth-changed', handleE2EAuthChanged);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (!session?.user) {
                    // Local E2E mode treats the persisted mock identity as the source of
                    // truth. The Supabase client points at an unreachable loopback backend
                    // there, so a null session event after a page reload must not log the
                    // operator out. A genuine E2E sign-out removes the storage key before
                    // dispatching, so it still falls through to the guest clear below.
                    if (isLocalWebE2E() && readE2ESession()) {
                        console.log('[AuthContext] Ignoring null remote session event while a local E2E identity is persisted');
                        return;
                    }
                    roleResolutionRequestIdRef.current++;
                    setInitializationError(null);
                    setSession(null);
                    setUser(null);
                    setRole(null);
                    setRoleResolved(true);
                    return;
                }

                setInitializationError(null);
                setSession(session);
                setUser(session.user);

                // Explicitly handle token refresh — update session state without re-resolving role
                if (event === 'TOKEN_REFRESHED') {
                    console.log('[AuthContext] Token refreshed, updating session state');
                    return;
                }

                if (isBootstrappingRef.current && event === 'INITIAL_SESSION') {
                    console.log('[AuthContext] Deferring initial-session role resolution during bootstrap');
                    return;
                }

                const shouldSkipAutoSync = isBootstrappingRef.current || suppressNextAutoSyncRef.current;
                const shouldPreserveResolvedState =
                    currentUserIdRef.current === session.user.id &&
                    currentRoleResolvedRef.current;

                if (suppressNextAutoSyncRef.current) {
                    console.log('[AuthContext] Consumed one-shot auto-sync suppression after reset');
                    suppressNextAutoSyncRef.current = false;
                }

                if (shouldSkipAutoSync && isBootstrappingRef.current) {
                    console.log('[AuthContext] Skipping auth-state sync during initial bootstrap');
                    void consumeSkipNextAutoSync();
                }

                void resolveRoleForSession(session.user, 'Auth-state', shouldSkipAutoSync, shouldPreserveResolvedState);
            }
        );

        return () => {
            const currentReqId = roleResolutionRequestIdRef.current;
            roleResolutionRequestIdRef.current = currentReqId + 1;
            if (isLocalWebE2E() && typeof window.removeEventListener === 'function') {
                window.removeEventListener('jetfarm:e2e-auth-changed', handleE2EAuthChanged);
            }
            subscription.unsubscribe();
        };
    }, []);

    // Role-based redirect and RBAC guard
    useEffect(() => {
        if (!initialized) return;

        const firstSegment = segments[0];
        const inAuthGroup = firstSegment === '(auth)';
        const isLoginRoute = firstSegment === 'login';
        const inLoading = firstSegment === 'loading';

        if (user && !roleResolved && !inLoading && !isLoginRoute) {
            console.log('[AuthContext] Waiting for role resolution before route guard redirect');
            return;
        }

        // 1. If not logged in and not on an auth/loading page, redirect to login
        if (!user && !inAuthGroup && !isLoginRoute && !inLoading) {
            console.log('[AuthContext] Guest detected on protected route, redirecting to login');
            router.replace('/login');
            return;
        }

        if (user && roleResolved && !role && !isLoginRoute && !inLoading) {
            console.warn('[AuthContext] Authenticated user has no resolved role, redirecting to login');
            router.replace('/login');
            return;
        }

        // 2. If logged in and on an auth/login page, redirect to loading to perform initial sync
        const isRootRoute = !segments.length && (pathname === '/' || pathname === '');
        if (user && roleResolved && role && (inAuthGroup || isLoginRoute || isRootRoute)) {
            console.log('[AuthContext] Authenticated user on auth page, redirecting to loading for sync');
            router.replace('/loading');
            return;
        }

        // 3. RBAC Guard: If logged in but in the wrong route group, redirect to role home
        if (user && roleResolved && role && firstSegment && firstSegment.startsWith('(')) {
            const groupRoleMap: Record<string, string[]> = {
                '(admin)': ['admin', 'main_office'],
                '(expenses-encoder)': ['expenses_encoder'],
            };

            const allowedRoles = groupRoleMap[firstSegment];
            if (allowedRoles && !allowedRoles.includes(role) && role !== 'admin' && role !== 'main_office') {
                console.warn(`[AuthContext] RBAC Violation: Use with role "${role}" attempted to access group "${firstSegment}". Redirecting...`);
                const homeRoute = ROLE_HOME_ROUTES[role as UserRole] ?? '/login';
                router.replace(homeRoute as any);
            }
        }
    }, [user, role, roleResolved, initialized, segments, pathname, router]);

    const signOut = async () => {
        console.log('[AuthContext] Signing out...');
        try {
            await AuthService.signOut();
        } catch (error) {
            console.warn('[AuthContext] Remote sign-out failed; clearing local session anyway:', error);
        } finally {
            // Clear local state immediately to trigger redirect even if the remote
            // session was already expired or the network is unavailable.
            setUser(null);
            setSession(null);
            setRole(null);
            setRoleResolved(true);
            setBranchId(null);
            setAreaId(null);
            setInitializationError(null);
            // Use replace to clear current screen from memory
            router.replace('/login');
        }
    };

    const toggleSunlightMode = async () => {
        try {
            const newMode = !sunlightMode;
            setSunlightMode(newMode);
            await AsyncStorage.setItem('sunlight_mode', String(newMode));
        } catch (e) {
            console.error('[AuthContext] Error saving sunlight mode:', e);
        }
    };

    const value = useMemo(() => ({
        user,
        session,
        role,
        roleResolved,
        branchId,
        areaId,
        userBranchRoles,
        switchBranchContext,
        sunlightMode,
        toggleSunlightMode,
        initialized,
        initializationError,
        signOut,
    }), [user, session, role, roleResolved, branchId, areaId, userBranchRoles, sunlightMode, initialized, initializationError]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

