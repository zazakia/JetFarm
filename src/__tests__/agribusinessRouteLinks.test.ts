/**
 * Guard: every absolute route literal the app pushes must resolve to a real file.
 *
 * The agribusiness teardown deletes route groups by the dozen. Expo Router fails
 * these at runtime (silently refuses the push on web), so a stale
 * `router.push('/(admin)/loans')` in a kept screen would look like a dead button,
 * not an error. This test walks the source tree instead of importing it, so it
 * costs nothing to run and cannot be broken by RN mocks.
 *
 * Known non-route literals (download endpoint, static video asset) are listed
 * explicitly so the rule stays strict for everything else.
 */

import fs from 'fs';
import path from 'path';

const APP_ROOT = 'app';
const SCAN_ROOTS = ['app', 'src'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'android', 'ios', 'dist', 'tmp', 'expo', 'build']);
/** Rooted at a file that is not a route (public/ assets, backend endpoints). */
const ALLOWED_NON_ROUTES = ['/download', '/version.json', '/videos/jetfarms.mp4'];

function collectSourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectSourceFiles(full, out);
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
}

/** Route groups are transparent to Expo Router, so `/accounting` from inside
 *  `app/(admin)/_layout.tsx` is valid. Resolve against every group as well. */
function routeGroups(): string[] {
    return fs.readdirSync(APP_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('('))
        .map((entry) => entry.name);
}

function existsAsRoute(segments: string[]): boolean {
    for (const base of ['', ...routeGroups()]) {
        let cur = APP_ROOT;
        const chain = base ? [base, ...segments] : segments;
        let ok = true;
        for (const segment of chain) {
            cur = path.join(cur, segment);
            const candidates = [cur, `${cur}.tsx`, `${cur}.ts`, path.join(cur, 'index.tsx')];
            if (!candidates.some((candidate) => fs.existsSync(candidate))) {
                ok = false;
                break;
            }
        }
        if (ok) return true;
    }
    return false;
}

const ROUTE_LITERAL = /['"`](\/[A-Za-z0-9_\-/()[\].]+)['"`]/g;

function routeLiteralsIn(text: string): string[] {
    const found: string[] = [];
    for (const match of text.matchAll(ROUTE_LITERAL)) {
        const literal = match[1];
        if (literal.includes('//')) continue;
        if (/\.(png|jpg|jpeg|svg|json|css|mp4)$/.test(literal)) continue;
        if (literal.startsWith('/api/')) continue;
        found.push(literal);
    }
    return found;
}

describe('route literals resolve to real screens', () => {
    const groups = routeGroups();

    it('finds the route groups this branch ships', () => {
        expect(groups).toEqual(expect.arrayContaining(['(admin)', '(expenses-encoder)']));
        expect(groups).not.toContain('(borrower)');
        expect(groups).not.toContain('(collector)');
        expect(groups).not.toContain('(cashier)');
    });

    it('every pushed route literal points at an existing screen', () => {
        const dangling: string[] = [];

        for (const root of SCAN_ROOTS) {
            for (const file of collectSourceFiles(root)) {
                if (file.includes('__tests__')) continue;
                const text = fs.readFileSync(file, 'utf8');
                for (const literal of routeLiteralsIn(text)) {
                    if (ALLOWED_NON_ROUTES.includes(literal)) continue;
                    const segments = literal.split('/').filter(Boolean);
                    if (segments.length === 0) continue;
                    if (!existsAsRoute(segments)) {
                        dangling.push(`${literal} (${file})`);
                    }
                }
            }
        }

        expect(dangling).toEqual([]);
    });
});
