import Constants from 'expo-constants';

export const APP_VERSION = '0.1.0';
export const APP_BUILD_NUMBER = 1;
export const APP_RELEASE_NAME = 'v0.1.0';
export const WATERMELONDB_SCHEMA_VERSION = 25;
export const APP_RELEASE_DATE = '2026-09-11';
export const APP_DOWNLOAD_URL = 'https://agri-one.pages.dev/download';
export const APP_VERSIONED_DOWNLOAD_URL = `https://agri-one.pages.dev/download/v${APP_VERSION}`;

export const PRIMARY_VERSION_URL = 'https://agri-one.pages.dev/version.json';
export const FALLBACK_VERSION_URL = 'https://agri-one.pages.dev/version.json';

/**
 * Returns the current runtime application version string (e.g. "0.1.0").
 */
export function getAppVersion(): string {
    return Constants.expoConfig?.version || APP_VERSION;
}

/**
 * Returns the formatted release badge (e.g. "v0.1.0").
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
