export type AdminGateVariant = 'none' | 'replace' | 'overlay';

export interface AdminGateState {
    initialized: boolean;
    user: boolean;
    roleResolved: boolean;
    role: string | null;
    routeAllowed: boolean;
}

/**
 * Which auth-gate presentation the admin shell layout should use.
 *
 * The layout used to REPLACE its <Slot /> outlet with AuthGateLoading while
 * auth/role resolved. Replacing the outlet unmounts the group's nested
 * navigator, which remounts at its default index route; on web cold reloads
 * that rewrites the URL to "/" and app/(admin)/index.tsx <Redirect>s to the
 * dashboard — every deep link bounces. On web the gate therefore becomes a
 * covering OVERLAY and the outlet stays mounted. Native (verified boot flow)
 * keeps the original replacing behavior.
 */
export function adminAuthGateVariant(state: AdminGateState, platform: string): AdminGateVariant {
    const restoring = state.initialized && state.user && !state.roleResolved;
    const signedOut = state.initialized && !state.user;
    const denied =
        state.initialized &&
        state.user &&
        state.roleResolved &&
        ((state.role !== 'admin' && state.role !== 'main_office') || !state.routeAllowed);

    if (!restoring && !signedOut && !denied) return 'none';
    return platform === 'web' ? 'overlay' : 'replace';
}

export function adminGateMessage(state: AdminGateState): string {
    return state.initialized && state.user && !state.roleResolved
        ? 'Restoring your access...'
        : 'Redirecting...';
}
