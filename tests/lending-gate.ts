/**
 * Lending feature-gate for the Playwright suite.
 *
 * Loan management ships dark: `system.lending` defaults to disabled in
 * src/constants/configDefaults.ts, so every lending route (borrowers, loans,
 * payments, collectors, lending reports, loan-products/collection-groups
 * settings…) renders FeatureDisabledNotice instead of the screen.
 *
 * The lending specs are kept in the repo but skip themselves unless BOTH:
 *   1. E2E_LENDING=1 is set when invoking Playwright, and
 *   2. the running app profile has the system.lending flag enabled
 *      (fresh pre-change DB, Settings > Feature Flags, or seed).
 *
 * Usage:
 *   E2E_LENDING=1 npx playwright test tests/institutional-loans.spec.ts
 */
export const LENDING_E2E_ENABLED = process.env.E2E_LENDING === '1';

export const LENDING_SKIP_REASON =
    'Lending is hidden by app default (system.lending=false); run with E2E_LENDING=1 against a profile that enables the flag';
