# Production Stability Audit

Date: 2026-04-21
Mode: Ralph
Workspace: `D:\GitHub\jetfarm-local`

## Verification Summary

| Check | Result | Evidence |
|---|---:|---|
| TypeScript | Pass | `npx.cmd tsc --noEmit --pretty false` exited 0 |
| Focused Jest matrix | Pass | 9 suites, 110 tests passed: LoanService, LoanCalculatorService, loanFormDefaults, AuthService, AuthService regression, AuthContext refresh-token, PaymentService, SyncService |
| Production web export | Pass | `npm.cmd run export:web:production` exported to `dist` |
| Script syntax | Pass | `node --check` passed for `scripts/check-auth-schema.mjs`, `scripts/start-prod.mjs`, `scripts/export-web-production.mjs` |
| Lint | Not configured | `package.json` has no lint script; TypeScript + Jest + export were used as closest configured gates |

## Fixed Issues

### 1. Renewal closing payment used current runtime date
- **Severity:** High
- **Affected files:** `src/services/LoanService.ts`, `src/services/__tests__/LoanService.test.ts`
- **Root cause:** Renewal payoff payment used `new Date().getTime()` instead of the loan release date passed to `LoanService.saveLoan`.
- **Impact:** Backdated or future-dated renewals could corrupt payoff history, daily cash reporting, and borrower statements.
- **Fix made:** Parsed `releaseDate` once in `LoanService.saveLoan`, reused the same timestamp for the new loan and the old-loan closing payment.
- **Verification:** Added regression test `dates the renewal closing payment on the new loan release date`; focused and grouped Jest runs passed.
- **Remaining risk:** Existing historical renewal closing payments dated incorrectly need data reconciliation if present.

### 2. Loan edit form could overwrite saved term and cycle
- **Severity:** High
- **Affected files:** `app/(admin)/loans/new.tsx`, `src/utils/loanFormDefaults.ts`, `src/utils/__tests__/loanFormDefaults.test.ts`
- **Root cause:** Auto-fill effects always recalculated `loanCycle` and forced `term = 40` for `days`, even after loading an existing loan into the edit form.
- **Impact:** Opening and saving an existing loan could unintentionally mutate loan economics and regenerated schedules.
- **Fix made:** Added explicit defaulting helpers and gated auto-fill so loan cycle is populated only in create mode and days term defaults only when switching to days in create mode.
- **Verification:** Added `loanFormDefaults` regression tests; focused and grouped Jest runs passed.
- **Remaining risk:** Full UI interaction test for the route was not added because importing the Expo route directly hangs under Jest; pure defaulting logic is covered.

### 3. Active-loan edits could destroy schedules after payments existed
- **Severity:** Critical
- **Affected files:** `src/services/LoanService.ts`, `src/services/__tests__/LoanService.test.ts`
- **Root cause:** The edit path permanently destroyed existing schedules and recreated all as pending for active loans, without preserving payment-to-schedule relationships.
- **Impact:** Existing payments could point to deleted schedules and paid/partial schedule state could regress.
- **Fix made:** `LoanService.saveLoan` now rejects active-loan edits once non-deleted payments exist, forcing a dedicated adjustment/reversal workflow instead of destructive schedule rebuilds.
- **Verification:** Added regression test `blocks active-loan edits once payments exist to avoid orphaning schedules`; focused and grouped Jest runs passed.
- **Remaining risk:** A future explicit recalculation workflow is still needed for legitimate post-payment loan corrections.

### 4. Auth role trusted local cache before server source of truth
- **Severity:** High
- **Affected files:** `src/services/AuthService.ts`, `src/services/__tests__/AuthService.test.ts`
- **Root cause:** `getCurrentUserRole` returned a local WatermelonDB role before checking Supabase.
- **Impact:** Stale/tampered local data could grant incorrect UI access before server checks failed; risk is severe when combined with weak RLS.
- **Fix made:** Supabase role lookup is now attempted first without filtering out inactive/deleted rows; missing, inactive, deleted, or role-less remote profiles return null and do not fall back to stale local cache. Local role is fallback cache only when the remote lookup itself fails.
- **Verification:** Added regression tests proving remote `collector` role wins over local `admin`, and missing/inactive/deleted remote profiles do not fall back to local admin. Existing offline fallback tests still pass.
- **Remaining risk:** Offline role fallback remains for offline usability; server RLS must still enforce true authorization.

### 5. Quick-login exposed staff accounts in production
- **Severity:** Medium
- **Affected files:** `app/login.tsx`, `src/services/AuthService.ts`, `src/services/__tests__/AuthService.test.ts`
- **Root cause:** Login page and AuthService loaded local/remote quick-login users regardless of environment, and hardcoded account emails were rendered.
- **Impact:** Production login leaked staff identifiers/roles and encouraged fixed-password quick access.
- **Fix made:** Quick-login service and login card are disabled when `NODE_ENV === 'production'`.
- **Verification:** Added `getQuickLoginUsers` production regression test; production export passed.
- **Remaining risk:** Hardcoded quick-login users still exist in source for non-production builds.

### 6. Legacy permissive Supabase RLS policy remained after hardening migration
- **Severity:** Critical
- **Affected files:** `supabase/migrations/20260421141000_drop_legacy_authenticated_full_access.sql`
- **Root cause:** Initial schema created `authenticated_full_access`; later hardening migration dropped a differently named policy and could leave full access enabled.
- **Impact:** Any authenticated user could potentially read/write all financial tables until the legacy policy is dropped.
- **Fix made:** Added migration to drop `authenticated_full_access` only from `app_borrowers`, `app_loans`, and `app_payments`, which already have replacement role-scoped policies.
- **Verification:** Static migration inspection; TypeScript/Jest/export unaffected.
- **Remaining risk:** Migration must be applied to every Supabase environment and verified with live RLS integration tests. Other app tables still need least-privilege replacement policies before their legacy full-access policy can be safely dropped.

### 7. Startup scripts depended on missing `dotenv` / `cross-env`
- **Severity:** Medium
- **Affected files:** `scripts/check-auth-schema.mjs`, `scripts/start-prod.mjs`, `package.json`
- **Root cause:** `check-auth-schema.mjs` imported `dotenv` without a declared dependency, and `start:prod` used undeclared `cross-env`.
- **Impact:** Startup/preflight scripts could fail in clean installs.
- **Fix made:** Replaced `dotenv` use with a small local env-file loader and replaced `start:prod` with a Node wrapper that sets `NODE_ENV=production` cross-platform.
- **Verification:** `node --check` passed for modified scripts; production export passed.
- **Remaining risk:** `check-auth-schema` still requires local Supabase/DB availability for full runtime validation.

### 8. Repo ignore rules did not cover backup/data artifacts broadly enough
- **Severity:** High
- **Affected files:** `.gitignore`
- **Root cause:** Real backup/data artifacts were present in the repo while ignore rules did not cover several generated dump patterns.
- **Impact:** Future backups, database files, and data exports could be accidentally added.
- **Fix made:** Added ignore rules for `backups/`, `artifacts/`, `data/`, `*.db`, `*_backup_*.json`, `app_loans_full.json`, and `excel_loans.json`.
- **Verification:** Static review.
- **Remaining risk:** Already tracked env/data files and git history still require explicit secret rotation and history cleanup; not performed because that is destructive/credential-dependent.

## Confirmed Remaining Risks / Not Fixed In This Pass

### A. Tracked `.env*` files and historical secrets/data exposure
- **Severity:** Critical
- **Affected files:** `.env`, `.env.production`, `.env.development`, `.env.test`, historical commits, backup/data artifacts.
- **Root cause:** Sensitive config and real borrower/financial backups have been committed previously.
- **Impact:** Credential/PII exposure if repo or history is shared.
- **Fix made:** Added forward-looking ignore rules only.
- **Verification:** Security audit lane found tracked env/data.
- **Remaining risk:** Requires owner action: rotate exposed credentials, remove tracked files with `git rm --cached`, purge history with BFG/filter-repo, and notify stakeholders if real data was exposed.

### B. Payment logic remains duplicated in collector and savings flows
- **Severity:** Critical
- **Affected files:** `app/(collector)/collection-sheet.tsx`, `app/(admin)/borrowers/[id]/savings.tsx`, `src/services/PaymentService.ts`
- **Root cause:** Some screens manually create payments/schedules/savings instead of using `PaymentService.postPayment`.
- **Impact:** Different entry points can produce inconsistent schedule, loan status, and savings results.
- **Fix made:** Not completed in this pass due broader workflow/refactor risk.
- **Verification:** Static audit.
- **Remaining risk:** Centralize these flows through `PaymentService` with integration tests.

### C. Payment deletion/reversal does not recompute loan state
- **Severity:** Critical
- **Affected files:** `app/(admin)/borrowers/[id]/passbook.tsx`, `src/services/BaseModelService.ts`, `src/services/PaymentService.ts`
- **Root cause:** Generic soft delete can remove a payment without recomputing schedules, loan status, or linked savings.
- **Impact:** Deleted payments can leave schedules/loans marked paid.
- **Fix made:** Not completed in this pass.
- **Verification:** Static audit.
- **Remaining risk:** Add `PaymentService.softDeletePayment` and route passbook deletion through it.

### D. Canonical net-cash-release formula is inconsistent
- **Severity:** High
- **Affected files:** loan UI, disbursement reports, CashService/MfiKpiService.
- **Root cause:** Different screens/services use principal, principal minus previous balance, or principal minus insurance.
- **Impact:** Cash and disbursement reports can disagree for renewals/withholding.
- **Fix made:** Not completed in this pass.
- **Verification:** Static audit.
- **Remaining risk:** Define one `netCashReleased` domain helper and apply across reports/services.

### E. iOS production bundle identifier is missing
- **Severity:** Medium
- **Affected file:** `app.json`
- **Root cause:** `expo.ios.bundleIdentifier` is absent.
- **Impact:** iOS EAS/App Store production build will be blocked.
- **Fix made:** Not changed because a production bundle id is a product/account decision.
- **Verification:** Static audit.
- **Remaining risk:** Add the real bundle identifier before iOS release.

### F. Dependency audit has unresolved high vulnerabilities
- **Severity:** High
- **Affected files:** `package-lock.json`, dependencies such as `xlsx`/dev tooling.
- **Root cause:** `npm audit` found high vulnerabilities; `xlsx` has no standard npm audit fix.
- **Impact:** Potential prototype pollution/ReDoS or tooling risks.
- **Fix made:** Not changed because dependency replacement/upgrades require scoped migration decisions.
- **Verification:** Security lane reported 42 vulnerabilities.
- **Remaining risk:** Replace/isolate vulnerable packages and add CI audit gates.



### 9. Null-role admin shell access was not denied
- **Severity:** High
- **Affected files:** `app/(admin)/_layout.tsx`
- **Root cause:** Admin layout treated `initialized && user && role === null` as not ready and continued rendering shell content.
- **Impact:** If role resolution returned null for a missing/inactive/deleted server profile, the admin shell could flash or remain reachable.
- **Fix made:** Admin layout now redirects authenticated null-role sessions to `/login` and renders nothing.
- **Verification:** TypeScript passed; production export passed.
- **Remaining risk:** Full runtime navigation smoke with a real disabled account still requires credentials.

### 10. Central payment service lacked audit logs for financial mutations
- **Severity:** High
- **Affected files:** `src/services/PaymentService.ts`, `src/services/__tests__/PaymentService.test.ts`
- **Root cause:** Centralized payment posting updated payments, schedules, savings, and loan status without writing action logs.
- **Impact:** Financial writes could be correct but unauditable, reducing accountability and rollback investigation quality.
- **Fix made:** PaymentService now records action logs for payment creation, schedule status updates, auto-savings deposits, and loan status updates inside the same write flow.
- **Verification:** Added regression test `writes audit logs for payment, schedule, savings, and loan status changes`; focused PaymentService test passed.
- **Remaining risk:** Existing historical payments created through this path before the fix will not have backfilled logs.



### 11. Payment deletion now preserves ledger consistency
- **Severity:** High
- **Affected files:** `src/services/PaymentService.ts`, `src/services/__tests__/PaymentService.test.ts`, `app/(admin)/borrowers/[id]/passbook.tsx`
- **Root cause:** Generic soft delete removed payment rows without reversing linked savings deposits or recomputing schedule/loan state.
- **Impact:** Deleted payments could leave loans/schedules marked paid and savings overstated.
- **Fix made:** Added `PaymentService.softDeletePayment(...)` to soft-delete the payment, soft-delete linked savings transactions by `reference_id`, recompute the loan, and write audit logs. Passbook deletion now uses this service path.
- **Verification:** Added regression test `soft-deletes a payment, reverses linked savings deposits, and recomputes loan state`; focused and grouped Jest runs passed.
- **Remaining risk:** A fuller payment reversal workflow may still be needed for edge cases like receipts already exported externally.

### 12. Collector quick collect now uses the central payment domain service
- **Severity:** Medium
- **Affected files:** `app/(collector)/collection-sheet.tsx`, `src/services/PaymentService.ts`
- **Root cause:** Collector quick collect used a custom inline write path separate from the central payment workflow.
- **Impact:** Collection-sheet payments could diverge from admin/payment-encoder behavior over time.
- **Fix made:** Replaced the collector-specific manual DB write with `PaymentService.postPayment(...)`.
- **Verification:** TypeScript passed; grouped regression suite including PaymentService passed; production export passed.
- **Remaining risk:** The savings-to-loan screen still has custom payment allocation logic and remains a follow-up target.

### 13. Savings-to-loan now uses the central payment service
- **Severity:** High
- **Affected files:** `src/services/PaymentService.ts`, `src/services/__tests__/PaymentService.test.ts`, `app/(admin)/borrowers/[id]/savings.tsx`
- **Root cause:** Savings-to-loan used a separate inline allocation path that duplicated payment, schedule, savings, and loan status logic.
- **Impact:** It could drift from the canonical payment workflow and previously inflated savings deposits by using the full loan savings amount instead of the per-schedule amount.
- **Fix made:** Added `PaymentService.applySavingsToLoan(...)` so savings-funded payments reuse the central payment/recompute/audit path and then add one linked `withdraw_loan` savings transaction.
- **Verification:** Added regression test `applies savings to a loan through the central payment flow`; targeted and grouped Jest runs passed.
- **Remaining risk:** UI-level runtime smoke for this flow with a real borrower is still advisable.

### 14. Collector/payment-encoder borrower selection is now scoped
- **Severity:** High
- **Affected files:** `src/components/BorrowerSelector.tsx`, `src/components/__tests__/BorrowerSelector.test.tsx`, `app/(payment-encoder)/index.tsx`
- **Root cause:** BorrowerSelector loaded all borrowers from local cache without collector scoping.
- **Impact:** Collectors using the payment encoder could see unrelated borrowers present on-device.
- **Fix made:** BorrowerSelector now accepts optional `role` and `collectorId`; when used by collectors it filters to assigned, non-deleted borrowers only. Payment encoder now passes auth scope through.
- **Verification:** Added BorrowerSelector regression test for collector scoping; targeted Jest passed.
- **Remaining risk:** Other screens with custom borrower lists should be reviewed for equivalent scoping.

