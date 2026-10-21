import Constants from 'expo-constants';
import { getRuntimeSupabaseUrl } from '../database/supabaseUrl';

export const APP_VERSION = '0.1.5';
export const APP_BUILD_NUMBER = 6;
export const APP_RELEASE_NAME = 'v0.1.5';
export const WATERMELONDB_SCHEMA_VERSION = 50;
export const APP_RELEASE_DATE = '2026-10-17';

/**
 * Origin that serves `/download` and `/version.json`. Production is the Cloudflare Pages
 * deployment, which publishes the redirect, the download page and a current manifest. The
 * self-hosted Hetzner vhost still serves the app but has no `/download` route (404) and a
 * stale manifest, so it is not the default release origin.
 */
export const PRODUCTION_APP_URL = 'https://jetfarm.pages.dev';

/**
 * Resolves the origin used for release and update URLs: an explicit build-time
 * override wins, then the browser's own origin (so preview deploys and localhost
 * stay self-consistent), then the production default.
 */
export const resolvePublicAppUrl = (
    envUrl: string | undefined = process.env.EXPO_PUBLIC_APP_URL,
    webOrigin: string | undefined =
        typeof window !== 'undefined' ? window.location?.origin : undefined
): string => {
    const stripTrailingSlash = (value?: string) => (value || '').replace(/\/+$/, '');
    const httpOnly = (value?: string) => {
        const normalized = stripTrailingSlash(value);
        return /^https?:\/\//i.test(normalized) ? normalized : '';
    };

    return httpOnly(envUrl) || httpOnly(webOrigin) || PRODUCTION_APP_URL;
};

export const PUBLIC_APP_URL = resolvePublicAppUrl();

export const APP_DOWNLOAD_URL = `${PUBLIC_APP_URL}/download`;
export const APP_VERSIONED_DOWNLOAD_URL = `${PUBLIC_APP_URL}/download/v${APP_VERSION}`;

export const PRIMARY_VERSION_URL = `${PUBLIC_APP_URL}/version.json`;

// deploy-cloudflare.mjs mirrors version.json into the public `downloads` bucket,
// so the fallback must be that origin: identical values made the retry useless.
export const FALLBACK_VERSION_URL = `${getRuntimeSupabaseUrl(
    process.env.EXPO_PUBLIC_SUPABASE_URL || ''
)}/storage/v1/object/public/downloads/version.json`;

/**
 * Returns the current runtime application version string (e.g. "0.1.5").
 */
export function getAppVersion(): string {
    return Constants.expoConfig?.version || APP_VERSION;
}

/**
 * Returns the formatted release badge (e.g. "v0.1.5").
 */
export function getReleaseName(): string {
    return `v${getAppVersion()}`;
}

/**
 * Returns the full release string including build number and database schema version.
 */
export function getFullReleaseString(): string {
    return `v${getAppVersion()} (Build ${APP_BUILD_NUMBER} • Schema v${WATERMELONDB_SCHEMA_VERSION})`;
}

/**
 * Returns standard footer copyright & release text.
 */
export function getAppFooterText(): string {
    return `Agri-One ${getReleaseName()} • Build ${APP_BUILD_NUMBER}`;
}
