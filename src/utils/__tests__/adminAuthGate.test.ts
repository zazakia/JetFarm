import { adminAuthGateVariant } from '../adminAuthGate';

/**
 * The admin shell layout used to REPLACE its <Slot /> outlet with an
 * AuthGateLoading screen while auth/role was resolving. On web cold reloads
 * that unmounts the group's nested navigator, which then remounts at its
 * default index route — the URL is rewritten to "/" and app/(admin)/index.tsx
 * <Redirect>s the user to the dashboard, killing every deep link.
 *
 * The outlet must stay mounted on web; the gate becomes a covering overlay.
 * Native keeps the original replacement behavior (verified APK boot flow).
 */
describe('adminAuthGateVariant', () => {
    const resolved = { initialized: true, user: true, roleResolved: true, role: 'admin', routeAllowed: true };

    it('keeps the outlet visible (overlay gate) on web while role is resolving', () => {
        expect(adminAuthGateVariant({ ...resolved, roleResolved: false }, 'web')).toBe('overlay');
    });

    it('keeps the outlet visible (overlay gate) on web when access is denied', () => {
        expect(adminAuthGateVariant({ ...resolved, role: 'collector' }, 'web')).toBe('overlay');
        expect(adminAuthGateVariant({ ...resolved, routeAllowed: false }, 'web')).toBe('overlay');
    });

    it('does not gate at all once an allowed role is resolved', () => {
        expect(adminAuthGateVariant(resolved, 'web')).toBe('none');
        expect(adminAuthGateVariant(resolved, 'android')).toBe('none');
    });

    it('does not gate before initialization on any platform', () => {
        expect(adminAuthGateVariant({ ...resolved, initialized: false }, 'web')).toBe('none');
        expect(adminAuthGateVariant({ ...resolved, initialized: false }, 'ios')).toBe('none');
    });

    it('uses the original replacing gate on native while role resolves', () => {
        expect(adminAuthGateVariant({ ...resolved, roleResolved: false }, 'ios')).toBe('replace');
    });

    it('replaces on native when the shell has no user', () => {
        expect(adminAuthGateVariant({ initialized: true, user: false, roleResolved: true, role: null, routeAllowed: true }, 'android')).toBe('replace');
    });

    it('overlays on web when the shell has no user', () => {
        expect(adminAuthGateVariant({ initialized: true, user: false, roleResolved: true, role: null, routeAllowed: true }, 'web')).toBe('overlay');
    });
});
