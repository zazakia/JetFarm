import { readFileSync } from 'fs';

/**
 * Postgres TLS configuration for the operational scripts in this repository.
 *
 * Verification is always on. `rejectUnauthorized: false` was the historical default in these
 * scripts, and it is the one setting that turns a credential leak into a man-in-the-middle:
 * the connection succeeds either way, so nothing downstream notices. A database behind a private
 * CA (the self-hosted stack) is supported by supplying that CA, not by disabling verification:
 *
 *   DATABASE_CA_FILE  path to a PEM bundle
 *   DATABASE_CA       the PEM contents inline
 *
 * Both are optional; with neither set the system CA store is used, which is what the hosted
 * Supabase endpoints need.
 */
export function pgSslConfig(env = process.env) {
    const inline = env.DATABASE_CA;
    if (inline && inline.includes('-----BEGIN')) {
        return { rejectUnauthorized: true, ca: inline };
    }
    const file = env.DATABASE_CA_FILE || inline;
    if (file) {
        return { rejectUnauthorized: true, ca: readFileSync(file, 'utf8') };
    }
    return { rejectUnauthorized: true };
}

/** Read a database password from the environment. Nothing is hardcoded and nothing is printed. */
export function requireDbPassword(env = process.env) {
    const password = env.SUPABASE_DB_PASSWORD || env.EXPO_PUBLIC_SUPABASE_DB_PASSWORD || env.DATABASE_PASSWORD;
    if (!password) {
        throw new Error('No database password in the environment (SUPABASE_DB_PASSWORD). Credentials are never hardcoded in this repo.');
    }
    return password;
}
