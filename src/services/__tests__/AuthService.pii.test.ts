/**
 * C3 guard: PII (emails, user IDs) must never reach the browser console in
 * this financial app. See docs/BUG-AUDIT-AND-REMEDIATION-PLAN.md §3.C3.
 *
 * Two layers:
 *  1. Runtime canary tests — drive real auth paths with distinctive canary
 *     identifiers and assert none of them appear in any console output.
 *  2. Source-scan guard — assert console.* statements in the auth layer do not
 *     interpolate identity variables at all.
 */
import * as fs from 'fs';
import * as path from 'path';
import { AuthService } from '../AuthService';
import { supabase } from '../../database/supabase';

jest.mock('../ErrorService', () => ({
    ErrorService: {
        handleError: jest.fn(),
        getUserMessage: jest.fn((err: any) => err?.message || 'Friendly error'),
        showErrorToast: jest.fn(),
        showSuccessToast: jest.fn(),
        showInfoToast: jest.fn(),
    },
    ErrorType: { AUTH: 'AUTH', SYNC: 'SYNC', NETWORK: 'NETWORK', UNKNOWN: 'UNKNOWN' },
}));

const mockAuthChain = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn().mockImplementation(function (this: any, resolve: any) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
    }),
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
        collections: { get: jest.fn(() => mockAuthCollection) },
        write: jest.fn((callback: any) => callback()),
        unsafeResetDatabase: jest.fn(),
    }
}));

const CANARY_EMAIL = 'canary-member-9f3a@example.invalid';
const CANARY_UID = 'canary-uid-7c81d2e4';

let consoleOutput: string[];

function captureConsole() {
    consoleOutput = [];
    const collect = (...args: any[]) => {
        consoleOutput.push(args.map((a) => String(a)).join(' '));
    };
    jest.spyOn(console, 'log').mockImplementation(collect);
    jest.spyOn(console, 'warn').mockImplementation(collect);
    jest.spyOn(console, 'error').mockImplementation(collect);
}

function expectNoCanaryInConsole() {
    const leaks = consoleOutput.filter(
        (line) => line.includes(CANARY_EMAIL) || line.includes(CANARY_UID)
    );
    expect(leaks).toEqual([]);
}

describe('AuthService PII guard (C3)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        captureConsole();
        mockAuthChain.maybeSingle.mockResolvedValue({ data: null, error: null });
        mockAuthCollection.fetch.mockResolvedValue([]);
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('signIn does not print the member email or user id to the console', async () => {
        (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
            data: { user: { id: CANARY_UID, email: CANARY_EMAIL }, session: null },
            error: null,
        });

        try {
            await AuthService.signIn(CANARY_EMAIL, 'pw-not-real');
        } catch (_e) {
            // Downstream profile/approval handling is out of scope for this guard;
            // what matters is what was printed while the attempt ran.
        }

        expectNoCanaryInConsole();
    });

    it('getCurrentUserRole does not print the uid or email to the console', async () => {
        try {
            await AuthService.getCurrentUserRole(CANARY_UID, CANARY_EMAIL);
        } catch (_e) {
            // Swallow — guard only asserts console hygiene.
        }

        expectNoCanaryInConsole();
    });

    it('sendPasswordResetEmail does not print the target address to the console', async () => {
        try {
            await AuthService.sendPasswordResetEmail(CANARY_EMAIL);
        } catch (_e) {
            // Swallow — guard only asserts console hygiene.
        }

        expectNoCanaryInConsole();
    });
});

describe('Auth layer source scan: no PII interpolation in console.* (C3)', () => {
    const files = [
        path.resolve(__dirname, '../../services/AuthService.ts'),
        path.resolve(__dirname, '../../store/AuthContext.tsx'),
    ];

    const PII_PATTERNS = [
        /\$\{[^}]*email[^}]*\}/i,
        /\$\{[^}]*\buid\b/i,
        /\$\{[^}]*user\??\.id/i,
        /,\s*(session\?\.user|data\?\.user)\?\.id\b/,
        /,\s*email\b/,
    ];

    it.each(files)('%s has no console call interpolating identity data', (file) => {
        const source = fs.readFileSync(file, 'utf8');
        const offenders = source
            .split(/\r?\n/)
            .filter((line) => /console\.(log|warn|error)\(/.test(line))
            .filter((line) => PII_PATTERNS.some((p) => p.test(line)));
        expect(offenders).toEqual([]);
    });
});
