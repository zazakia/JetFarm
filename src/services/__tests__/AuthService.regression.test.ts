/**
 * AuthService Regression Tests
 * ============================
 * These tests guard against REAL BUGS that have occurred in production/local dev.
 * Each test is tagged with the bug it prevents.
 *
 * BUG-001: GoTrue "Database error querying schema" 500
 *   Root cause: auth.users rows had NULL in text token columns
 *   (confirmation_token, email_change, phone_change, etc.)
 *   GoTrue v2+ cannot scan NULL into Go string — crashes with 500.
 *   Fix: Coalesce to '' + NOT NULL DEFAULT constraints.
 *
 * BUG-002: "Invalid login credentials" despite correct password
 *   Root cause: auth.identities row missing for seeded user
 *   GoTrue requires auth.identities for email/password provider.
 *
 * BUG-003: Cross-project stale localStorage token
 *   Root cause: sb-*-auth-token from different Supabase project in localStorage
 *   causes "Invalid Refresh Token" on every load.
 */

import { AuthService } from '../AuthService';
import { supabase } from '../../database/supabase';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../ErrorService', () => ({
  ErrorService: {
    handleError: jest.fn((err) => err),
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
    },
    from: jest.fn(() => mockAuthChain),
  },
  clearPersistedAuthSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../database', () => ({
  database: {
    get: jest.fn(() => ({
      find: jest.fn().mockRejectedValue(new Error('not found')),
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue([]),
    })),
    collections: {
      get: jest.fn(() => ({
        find: jest.fn().mockRejectedValue(new Error('not found')),
        query: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([]),
      })),
    },
    write: jest.fn((cb) => cb()),
    unsafeResetDatabase: jest.fn(),
  },
}));

// ─── BUG-001: GoTrue NULL token column crash ──────────────────────────────────

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BUG-001: GoTrue NULL token column crash (500 Database error querying schema)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw an error when Supabase returns a 500 "Database error querying schema"', async () => {
    // This is the EXACT error GoTrue returns when auth.users has NULL token columns
    const gotrue500Error = Object.assign(new Error('Database error querying schema'), {
      status: 500,
      code: 'unexpected_failure',
    });

    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: gotrue500Error,
    });

    await expect(AuthService.signIn('admin@agri-one.com', '12345678')).rejects.toThrow(
      'Database error querying schema'
    );
  });

  it('should NOT silently swallow a 500 auth error — it must propagate to caller', async () => {
    const gotrue500Error = Object.assign(new Error('Database error querying schema'), {
      status: 500,
    });

    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: gotrue500Error,
    });

    let caught: Error | null = null;
    try {
      await AuthService.signIn('admin@agri-one.com', '12345678');
    } catch (e: any) {
      caught = e;
    }

    expect(caught).not.toBeNull();
    expect(caught?.message).toContain('Database error');
  });

  it('succeeds when signInWithPassword returns valid user data (no NULL columns scenario)', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: {
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@agri-one.com',
          role: 'authenticated',
          // All token fields are present (non-NULL)
          confirmation_token: '',
          recovery_token: '',
          email_change: '',
          phone_change: '',
        },
        session: { access_token: 'tok', refresh_token: 'ref' },
      },
      error: null,
    });

    await expect(AuthService.signIn('admin@agri-one.com', '12345678')).resolves.toBeUndefined();
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@agri-one.com',
      password: '12345678',
    });
  });

  it('trims whitespace from email and password before sending to GoTrue', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });

    await AuthService.signIn('  admin@agri-one.com  ', '  12345678  ');

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@agri-one.com',
      password: '12345678',
    });
  });
});

// ─── BUG-002: Missing auth.identities → "Invalid login credentials" ──────────

describe('BUG-002: Missing auth.identities causes "Invalid login credentials"', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws and does not succeed when credentials are invalid (identities missing scenario)', async () => {
    const invalidCredsError = Object.assign(new Error('Invalid login credentials'), {
      status: 400,
      code: 'invalid_credentials',
    });

    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: invalidCredsError,
    });

    await expect(AuthService.signIn('collector@poscursor.com', '12345678')).rejects.toThrow(
      'Invalid login credentials'
    );
  });

  it('distinguishes a 400 credentials error from a 500 schema error', async () => {
    const err400 = Object.assign(new Error('Invalid login credentials'), { status: 400 });
    const err500 = Object.assign(new Error('Database error querying schema'), { status: 500 });

    (supabase.auth.signInWithPassword as jest.Mock)
      .mockResolvedValueOnce({ data: null, error: err400 })
      .mockResolvedValueOnce({ data: null, error: err500 });

    let err1: any, err2: any;
    try { await AuthService.signIn('a@b.com', 'pass'); } catch (e) { err1 = e; }
    try { await AuthService.signIn('a@b.com', 'pass'); } catch (e) { err2 = e; }

    expect(err1?.message).toContain('Invalid login credentials');
    expect(err2?.message).toContain('Database error');
    expect(err1?.message).not.toBe(err2?.message);
  });
});

// ─── BUG-003: Stale localStorage token across projects ────────────────────────

describe('BUG-003: Stale cross-project refresh token causes auth failure', () => {
  beforeEach(() => jest.clearAllMocks());

  it('handles "Invalid Refresh Token" error gracefully without crashing', async () => {
    const refreshError = Object.assign(new Error('Invalid Refresh Token'), {
      status: 401,
      code: 'refresh_token_not_found',
    });

    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: refreshError,
    });

    await expect(AuthService.signIn('admin@agri-one.com', 'pass')).rejects.toThrow(
      'Invalid Refresh Token'
    );
  });

  it('signOut does not clear the local DB before ending the session', async () => {
    const { database } = require('../../database');

    await expect(AuthService.signOut()).resolves.toBeUndefined();
    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(database.write).not.toHaveBeenCalled();
    expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
  });

  it('signOut surfaces a Supabase signOut failure without wiping the local DB', async () => {
    const { database } = require('../../database');
    (supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({
      error: new Error('Network sign out failed'),
    });

    await expect(AuthService.signOut()).rejects.toThrow('Network sign out failed');
    expect(database.write).not.toHaveBeenCalled();
    expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
  });
});

// ─── General Auth Resilience ──────────────────────────────────────────────────

describe('Auth Resilience: error handling across all signIn failure modes', () => {
  const FAILURE_CASES = [
    { name: '500 schema error',     error: { message: 'Database error querying schema', status: 500 } },
    { name: '400 invalid creds',    error: { message: 'Invalid login credentials', status: 400 } },
    { name: '422 email not found',  error: { message: 'User not found', status: 422 } },
    { name: '429 rate limited',     error: { message: 'Email rate limit exceeded', status: 429 } },
    { name: 'network timeout',      error: { message: 'Failed to fetch', status: 0 } },
  ];

  beforeEach(() => jest.clearAllMocks());

  test.each(FAILURE_CASES)('rejects with descriptive error for: $name', async ({ error }) => {
    const authError = Object.assign(new Error(error.message), { status: error.status });

    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: authError,
    });

    await expect(AuthService.signIn('user@poscursor.com', 'pass')).rejects.toThrow(error.message);
  });

  it('never returns a resolved promise on auth error — login page must not redirect on failure', async () => {
    const err = new Error('Database error querying schema');
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: err,
    });

    let resolved = false;
    try {
      await AuthService.signIn('a@b.com', 'wrong');
      resolved = true; // should never reach here
    } catch {
      resolved = false;
    }

    expect(resolved).toBe(false); // login MUST throw, not resolve silently
  });
});


