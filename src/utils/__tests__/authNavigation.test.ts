import { 
    isProtectedRouteGroup, 
    isRouteAllowedForRole, 
    buildRouteWithGroup 
} from '../authNavigation';

describe('authNavigation utility', () => {
    describe('isProtectedRouteGroup', () => {
        it('returns true for the protected segment groups this variant ships', () => {
            expect(isProtectedRouteGroup('(admin)')).toBe(true);
            expect(isProtectedRouteGroup('(expenses-encoder)')).toBe(true);
        });

        it('returns false for the deleted lending route groups', () => {
            // A stale entry here would make a non-existent group "protected", so the guard would
            // refuse to redirect away from it - see the comment in authNavigation.ts.
            for (const group of ['(collector)', '(borrower)', '(cashier)', '(loan-encoder)',
                '(payment-encoder)', '(branch-manager)', '(area-supervisor)', '(commissary)', '(executive)']) {
                expect(isProtectedRouteGroup(group)).toBe(false);
            }
        });

        it('returns false for public or undefined segment groups', () => {
            expect(isProtectedRouteGroup(undefined)).toBe(false);
            expect(isProtectedRouteGroup('login')).toBe(false);
        });
    });

    describe('isRouteAllowedForRole', () => {
        it('returns false if route or role is missing', () => {
            expect(isRouteAllowedForRole(null, 'admin')).toBe(false);
            expect(isRouteAllowedForRole('/(admin)/dashboard', null)).toBe(false);
        });

        it('returns true if the role can access the segment group of the route', () => {
            expect(isRouteAllowedForRole('/(admin)/agribusiness', 'admin')).toBe(true);
            expect(isRouteAllowedForRole('/(admin)/accounting', 'main_office')).toBe(true);
            expect(isRouteAllowedForRole('/(expenses-encoder)/entry', 'expenses_encoder')).toBe(true);
        });

        it('returns false when a role reaches outside its group or a deleted route group', () => {
            expect(isRouteAllowedForRole('/(admin)/dashboard', 'expenses_encoder')).toBe(false);
            expect(isRouteAllowedForRole('/(expenses-encoder)/entry', 'admin')).toBe(false);
            expect(isRouteAllowedForRole('/(collector)/sheet', 'admin')).toBe(false);
            expect(isRouteAllowedForRole('/(borrower)/profile', 'admin')).toBe(false);
            expect(isRouteAllowedForRole('/(cashier)/pos', 'main_office')).toBe(false);
        });

        it('returns false for a retired role name', () => {
            expect(isRouteAllowedForRole('/(admin)/dashboard', 'collector')).toBe(false);
            expect(isRouteAllowedForRole('/(admin)/dashboard', 'branch_cashier')).toBe(false);
        });
    });

    describe('buildRouteWithGroup', () => {
        it('returns null if the first segment is not a protected group', () => {
            expect(buildRouteWithGroup('login', '/path')).toBeNull();
        });

        it('returns pathname as-is if it already starts with the segment', () => {
            expect(buildRouteWithGroup('(admin)', '/(admin)/dashboard')).toBe('/(admin)/dashboard');
        });

        it('returns segment if pathname is root or empty', () => {
            expect(buildRouteWithGroup('(admin)', '/')).toBe('/(admin)');
            expect(buildRouteWithGroup('(admin)', '')).toBe('/(admin)');
        });

        it('prepends segment and formats pathname with or without leading slash', () => {
            expect(buildRouteWithGroup('(admin)', 'dashboard')).toBe('/(admin)/dashboard');
            expect(buildRouteWithGroup('(admin)', '/dashboard')).toBe('/(admin)/dashboard');
        });
    });
});
