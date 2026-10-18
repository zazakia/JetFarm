'use strict';

/**
 * Which staged `.env*` paths the pre-commit gate must refuse.
 *
 * Real env files carry production secrets and are gitignored, so staging one is
 * always a mistake. `.env.example` is the exception: it is a TRACKED template
 * with no secret values, documented in AGENTS.md and consumed by onboarding.
 * The previous blanket `.startsWith('.env')` rule blocked the template too,
 * which left agents choosing between `--no-verify` and silently dropping a
 * legitimate documentation change.
 *
 * Extracted as a pure helper so `scripts/changed-files-gate.mjs` (ESM) and the
 * Jest suite (CJS) share one definition.
 */

const ENV_TEMPLATE = '.env.example';

/** True only for the exact root-level template, not nested or suffixed lookalikes. */
function isCommittableEnvTemplate(file) {
    return file === ENV_TEMPLATE;
}

/** Basename test: `.env`, `.env.local`, `android/.env.production` all count. */
function isEnvFile(file) {
    const base = String(file).split(/[\\/]/).pop() || '';
    return base.startsWith('.env');
}

/** Staged paths that must block the commit, in input order. */
function blockedEnvFiles(files) {
    return (files || []).filter((file) => isEnvFile(file) && !isCommittableEnvTemplate(file));
}

module.exports = { ENV_TEMPLATE, blockedEnvFiles, isCommittableEnvTemplate, isEnvFile };
