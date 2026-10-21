import { UserRole } from '../constants/roles';

export const LAST_AUTHORIZED_ROUTE_KEY = 'last_authorized_route';

// Agribusiness-only variant: the collector, borrower, encoder, cashier, manager, supervisor,
// commissary and executive route groups are deleted, so they must not survive here either -
// PROTECTED_GROUPS is derived from this map, and a stale entry makes a non-existent group
// "protected", which the route guard then refuses to redirect away from.
const ROLE_GROUPS: Record<UserRole, string[]> = {
    admin: ['(admin)'],
    main_office: ['(admin)'],
    expenses_encoder: ['(expenses-encoder)'],
};

const PROTECTED_GROUPS = new Set(Object.values(ROLE_GROUPS).flat());

export const isProtectedRouteGroup = (segment: string | undefined) =>
    !!segment && PROTECTED_GROUPS.has(segment);

export const isRouteAllowedForRole = (route: string | null | undefined, role: string | null | undefined) => {
    if (!route || !role) return false;

    const firstSegment = route.replace(/^\//, '').split('/')[0];
    const allowedGroups = ROLE_GROUPS[role as UserRole];
    return !!allowedGroups?.includes(firstSegment);
};

export const buildRouteWithGroup = (firstSegment: string | undefined, pathname: string) => {
    if (!isProtectedRouteGroup(firstSegment)) return null;
    if (pathname.startsWith(`/${firstSegment}`)) return pathname;
    if (pathname === '/' || pathname === '') return `/${firstSegment}`;
    return `/${firstSegment}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
};
