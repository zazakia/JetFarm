import { 
    isProtectedRouteGroup, 
    isRouteAllowedForRole, 
    buildRouteWithGroup 
} from '../authNavigation';

describe('authNavigation utility', () => {
    describe('isProtectedRouteGroup', () => {
        it('returns true for protected segment groups', () => {
            expect(isProtectedRouteGroup('(admin)')).toBe(true);
            expect(isProtectedRouteGroup('(collector)')).toBe(true);
            expect(isProtectedRouteGroup('(borrower)')).toBe(true);
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
            expect(isRouteAllowedForRole('/(admin)/dashboard', 'admin')).toBe(true);
            expect(isRouteAllowedForRole('/(collector)/home', 'collector')).toBe(true);
            expect(isRouteAllowedForRole('/(payment-encoder)/add', 'collector')).toBe(true);
            expect(isRouteAllowedForRole('/(cashier)/pos', 'branch_cashier')).toBe(true);
            expect(isRouteAllowedForRole('/(branch-manager)/receiving', 'branch_manager')).toBe(true);
            expect(isRouteAllowedForRole('/(area-supervisor)/dashboard', 'area_supervisor')).toBe(true);
            expect(isRouteAllowedForRole('/(commissary)/dispatch', 'commissary_keeper')).toBe(true);
            expect(isRouteAllowedForRole('/(executive)/dashboard', 'executive')).toBe(true);
        });

        it('returns false if the role cannot access the segment group of the route', () => {
            expect(isRouteAllowedForRole('/(admin)/dashboard', 'collector')).toBe(false);
            expect(isRouteAllowedForRole('/(borrower)/profile', 'admin')).toBe(false);
            expect(isRouteAllowedForRole('/(executive)/dashboard', 'branch_cashier')).toBe(false);
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
