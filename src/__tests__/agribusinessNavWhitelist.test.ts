/**
 * Agribusiness-only navigation whitelist guard (branch: agribusiness-only).
 *
 * Why this exists: the nav arrays in src/components/SidebarContent.tsx, the role homes in
 * src/constants/roles.ts and the route prefixes in src/utils/featureFlags.ts each enumerate
 * features independently of the route files. Two failure modes are common when features are
 * removed: a menu item that survives its screen (dead click), and a ROLE_HOME_ROUTES entry that
 * points at a deleted route group, which loops the login redirect at app/(admin)/_layout.tsx:103-107.
 * Source text is parsed rather than imported on purpose: importing SidebarContent.tsx pulls the
 * whole React Native component tree into a test whose subject is the route table.
 */
import fs from 'fs';
import path from 'path';

const read = (rel: string[]) =>
    fs.readFileSync(path.join(process.cwd(), ...rel), 'utf8');

const SIDEBAR = ['src', 'components', 'SidebarContent.tsx'];
const ROLES = ['src', 'constants', 'roles.ts'];
const FLAGS = ['src', 'utils', 'featureFlags.ts'];

const FORBIDDEN_SEGMENTS = [
    '(borrower)',
    '(collector)',
    '(loan-encoder)',
    '(payment-encoder)',
    '(cashier)',
    '(branch-manager)',
    '(commissary)',
    '(executive)',
    '(area-supervisor)',
    'borrowers',
    'loans',
    'payments',
    'loan-approvals',
    'collectors',
    'file-cases',
    'cic',
    'remittances',
    'groups',
    'modules',
    'marketplace',
    'payroll',
    'franchise',
    'loan-application',
    'loan-calculator',
];

// Everything a kept route may resolve to. Anything outside this is a non-agribusiness entry point.
const ALLOWED =
    /^(app\/)?(\(admin\)\/(agribusiness|accounting|reports|settings|users|areas|cash-on-hand|bank-accounts|expenses|transfers|returns|index|_layout)|\(expenses-encoder\)|login|register|select-branch|loading|sync-center|index|_layout)/;

const routeCandidates = (route: string): string[] => {
    const bare = route.replace(/^\/+/, '').replace(/\/+$/, '');
    const key = bare === '' ? 'index' : bare;
    const cands = [`${key}.tsx`, `${key}/index.tsx`];
    if (!key.startsWith('(')) cands.push(`(admin)/${key}.tsx`, `(admin)/${key}/index.tsx`);
    return cands;
};

const resolves = (route: string): string | null => {
    for (const cand of routeCandidates(route)) {
        if (fs.existsSync(path.join(process.cwd(), 'app', cand))) return `app/${cand}`;
    }
    return null;
};

const routesIn = (rel: string[], pattern: RegExp): string[] =>
    [...read(rel).matchAll(pattern)].map((m: RegExpMatchArray) => m[1]);

// The role homes live in one Record literal; parsing the block instead of the whole file keeps a
// stray `: '/something'` elsewhere in roles.ts from being read as a route.
const roleHomeRoutes = (): string[] => {
    const src = read(ROLES);
    const block = src.match(/ROLE_HOME_ROUTES:\s*Record<UserRole,\s*string>\s*=\s*\{([\s\S]*?)\n\}/);
    if (!block) throw new Error('ROLE_HOME_ROUTES block not found in src/constants/roles.ts');
    return [...block[1].matchAll(/:\s*'([^']+)'/g)].map((m: RegExpMatchArray) => m[1]);
};

describe('agribusiness-only navigation whitelist', () => {
    const sidebarRoutes = routesIn(SIDEBAR, /route:\s*'([^']+)'/g);
    const roleHomes = roleHomeRoutes();
    const flagPrefixes = routesIn(FLAGS, /prefix:\s*'([^']+)'/g);

    it('parses the three enumerations it guards', () => {
        expect(sidebarRoutes.length).toBeGreaterThan(10);
        expect(roleHomes.length).toBe(12);
        expect(flagPrefixes.length).toBeGreaterThan(5);
    });

    it('declares no non-agribusiness segment in any enumeration', () => {
        const offenders = [...sidebarRoutes, ...roleHomes, ...flagPrefixes]
            .map((route) => ({ route, hit: FORBIDDEN_SEGMENTS.find((s) => route.includes(`/${s}`) || route.includes(`${s}/`) || route.endsWith(`/${s}`)) }))
            .filter((entry) => entry.hit);
        expect(offenders).toEqual([]);
    });

    it('resolves every sidebar route and role home to a real file', () => {
        const dangling = [...sidebarRoutes, ...roleHomes].filter((route) => !resolves(route));
        expect(dangling).toEqual([]);
    });

    it('resolves every feature-flag prefix, or documents it as a parent route', () => {
        // A prefix may name a directory group that is matched by startsWith at runtime, so it is
        // allowed to resolve as a directory instead of a file.
        const dangling = flagPrefixes.filter(
            (prefix) =>
                !resolves(prefix) &&
                !fs.existsSync(path.join(process.cwd(), 'app', prefix.replace(/^\/+/, ''))) &&
                !fs.existsSync(path.join(process.cwd(), 'app', '(admin)', prefix.replace(/^\/+/, '')))
        );
        expect(dangling).toEqual([]);
    });

    it('points every existing nav target at an allowed agribusiness/finance path', () => {
        const offList = [...sidebarRoutes, ...roleHomes]
            .map((route) => ({ route, file: resolves(route) }))
            .filter((entry): entry is { route: string; file: string } => Boolean(entry.file))
            .filter((entry) => !ALLOWED.test(entry.file));
        expect(offList).toEqual([]);
    });
});
