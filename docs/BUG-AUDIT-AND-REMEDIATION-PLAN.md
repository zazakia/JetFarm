# Bug Audit & Remediation Plan

**Date:** 2026-09-26
**Commit audited:** `35bef44` (main)
**Method:** deterministic local tooling (tsc, ESLint, Jest, static scans, schema/contract diffing)
**Note:** Subagent-based exploratory audit was unavailable (account credit exhaustion), so every
finding below is backed by a reproducible command + file:line rather than narrative review.

---

## 1. Verification baseline (what the existing gates say)

| Gate | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` | **exit 0** |
| Lint | `npx eslint .` | **exit 0** |
| Unit/integration | `npx jest --no-coverage` | **206 suites / 1635 tests, all pass**, 61.8s |

**Read this before trusting those greens.** All three gates are configured to pass:

- `tsconfig.json` → `"strict": false`
- `eslint.config.js` → no `no-console` rule, no `@typescript-eslint/no-explicit-any` rule

So the suite is genuinely healthy, but the static gates are largely ceremonial. Every critical
finding in this report lives in the blind spot those two settings create.

## 2. What I checked and cleared

Recorded explicitly so this work is not repeated as phantom bug-fixing:

- **Sync table contract — sound.** All 88 WatermelonDB tables appear in
  `src/services/syncTableContract.json`, and **all 88 remote targets resolve to a real
  `CREATE TABLE`** in `supabase/migrations/` + `supabase/queries/schema_corrected.sql`
  (0 unresolved). My initial "20 tables missing from migrations" alarm was a **false positive**:
  config tables are `app_`-prefixed remotely (`loan_products` → `app_loan_products`,
  `file_cases` → `app_file_cases`), which a naive name-matching scan misses.
- **No silent-data-loss bug in sync.** `SyncService.ts:61-64` documents and enforces exactly the
  right failure mode (missing *core* table must hard-fail rather than advance the WatermarkDB
  watermark). `OPTIONAL_REMOTE_TABLES` is scoped only to config tables.
- **No arbitrary hex colors.** `(bg|text|border)-[#...]` → **0 matches**; NativeWind convention held.
- **No hardcoded credentials in `src/`/`app/`.** No JWT-shaped or `sb_secret_` literals in source.
- **Encryption-key leakage in the built bundle — currently NOT occurring.** I initially believed
  `POSCursor_Sec_2024_Ph` was present in `dist/`; that was my own shell-logic error. Verified:
  0 occurrences anywhere in `dist/`. The committed literal exists only in tests/jest-setup.
- **Empty `catch {}` blocks — 1 only**, and it is intentional URL-fallback
  (`src/services/AppUpdateService.ts:118-120`). Not a defect.
- **Migration/seed regression coverage is unusually strong** —
  `src/database/schemaContracts.regression.test.ts` guards contract shape, credential-free
  migration scripts, and read-only verifier defaults.

---

## 3. Confirmed defects

### C1 — CRITICAL: production builds encrypt real financial data with a repo-committed key

**Where:** `scripts/export-web-production.mjs:37`

```js
EXPO_PUBLIC_ENCRYPTION_KEY=${process.env.EXPO_PUBLIC_ENCRYPTION_KEY || 'mock-primary-key'}
```

**Evidence chain:**
1. `.env.production` **does not exist on disk** (only `.env.example`, `.env.local`, `.env.hetzner`,
   `.env.test`, `.env.neon.example`).
2. `.env.local` does **not** define `EXPO_PUBLIC_ENCRYPTION_KEY`; only `.env.example` lists it.
3. So if `EXPO_PUBLIC_SUPABASE_URL` is present in the environment, the export path silently writes
   a synthetic `.env.production` whose AES key is the literal string `mock-primary-key` — the same
   placeholder already committed at `src/jest-setup.ts:213`.
4. `EncryptionService.encrypt()` then succeeds, logs nothing alarming, and stamps `AES::v1::` —
   so the product *appears* encrypted while the key is public in this repository.

**Impact:** confidentiality of sensitive cooperative/financial records is zero for any build produced
through this path, and the failure is invisible — no error, no warning, a valid-looking prefix.

**Root cause:** a test fixture default was promoted into a production code path as a fallback.

**Fix (see Phase 1):** fail closed, never substitute a key.

---

### C2 — HIGH: `deploy-cloudflare.mjs` crashes mid-deploy on missing `.env.production`

**Where:** `scripts/deploy-cloudflare.mjs:79` and `:246`

Both do `readFileSync('.env.production', 'utf8')` with **no `existsSync` guard**, inside a `try`
block whose `catch` path continues rather than aborting early.

**Impact:** the APK upload to Supabase Storage CDN can succeed while the subsequent `version.json`
upload throws — leaving a **new APK published against a stale manifest**, i.e. devices on the wrong
installer version. This is a partial-publish failure, the worst kind to debug.

**Compounding doc defect:** `AGENTS.md` ("ENVIRONMENT & CREDENTIALS CONVENTION") instructs agents
that production secrets are *"stored exclusively on local disk in `.env.production`"* and that they
must *"read `.env.production` directly from disk for production operations, deployments, and
migrations"* without prompting the user. **That file is absent**, so any agent following the
documented runbook hits C2's crash or C1's placeholder key.

---

### C3 — HIGH: PII written to the browser console in a financial app

**Scale:** **595** `console.log/warn/error` calls in `src/` + `app/`; **19** interpolate identity
data directly.

**Evidence:**
- `src/services/AuthService.ts:77` — logs the signing user's **email address**
- `src/services/AuthService.ts:183` — logs email or user id during role resolution
- `src/services/AuthService.ts:436` — logs the **target address of every password-reset email**
- `src/store/AuthContext.tsx:317` — logs `session.user.id` **and** email on every session change

**Impact:** member and staff emails plus Supabase user UUIDs persist in the shared browser console
(devtools, screen recordings, remote-session support, error-reporter DOM captures). No gate catches it
because `no-console` is not enabled.

**Root cause:** logging used as the debugging strategy, then never gated behind a dev flag or logger.

---

### C4 — MEDIUM: 101 files break the project's own documented accessibility rule

**Rule (`AGENTS.md`, CONVENTIONS):** *"Always explicitly specify `placeholderTextColor="#9CA3AF"`
and text color classes on `<TextInput>` to prevent white-on-white dark mode bugs."*

**Measured:** of 101 files containing `<TextInput>`, **0 declare `placeholderTextColor`** in
`placeholderTextColor`-free state — i.e. **101 non-compliant files**, spanning login, registration,
loan origination, POS/cashier, collector, and the entire accounting module. Representative:
`app/login.tsx`, `app/register.tsx`, `app/(admin)/loans/new.tsx`,
`app/(admin)/borrowers/new.tsx`, `app/(cashier)/pos.tsx`, `src/components/SearchBar.tsx`.

**Impact:** placeholder text can render white-on-white in dark mode across most data-entry surfaces —
invisible labels in the forms that capture money and member records.

**Root cause:** a convention with no enforcing lint rule. 101 violations is a signal to fix the
*component*, not to hand-edit 101 files.

---

### C5 — MEDIUM: type safety is nominal, so `tsc` green proves little

**Measured across `src/` + `app/`:**

| Pattern | Count |
|---|---|
| `as any` casts | **746** |
| `: any` annotations | **871** |
| `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error` | **6** |

Combined with `"strict": false`, the 1635-test suite is the only real type defense. Casts concentrate
exactly where money is computed (`(error as any).status` in the auth path; `getQuickLoginUsers()`
returns `Map<string, any>` at `AuthService.ts:345`).

---

### C6 — MEDIUM: three duplicated migration pairs with divergent timestamps

```
audit_fixes_part2.sql      20260411150000  +  20260420172003
add_get_server_time.sql    20260412173000  +  20260420172010
secure_active_loans.sql    20260418013800  +  20260418024343
```

**Impact:** two files applying the same DDL under different versions makes fresh-database replay
order-dependent and non-idempotent (second application can error or double-apply grants/policies).
It also breaks "reproduce production schema from the repo" as a recovery strategy.

---

### C7 — MEDIUM: authentication quick-login fails **open**

**Where:** `src/services/AuthService.ts:39-47`

```ts
const explicitSetting = process.env.EXPO_PUBLIC_ENABLE_QUICK_LOGIN?.trim().toLowerCase();
if (explicitSetting === 'false') return false;
return true;                      // unset => ENABLED
```

**Impact:** if the flag is omitted from a production env file, `app/login.tsx:164` renders the
quick-access UI and `getQuickLoginUsers()` lists real staff accounts (name, email, role) — an
**account/role enumeration surface** on the public login screen.

**Severity limiter — verified, do not overstate this:** it is *not* an auth bypass. Outside local E2E
`quickSignIn()` falls through to real `signIn()` (`AuthService.ts:61-66`), and `isLocalWebE2E()`
guards the token-less path. The defect is fail-open default + disclosure, not login evasion.

**Note:** tests at `AuthService.test.ts:113,126,134` assert `true` for the unset case, so the
fail-open is currently *codified* — flipping the default requires updating those expectations
deliberately, not as a drive-by.

---

### C8 — LOW/MEDIUM: `AGENTS.md` is materially stale (misleads agents and humans)

| `AGENTS.md` claims | Actual |
|---|---|
| schema **v25**, **19** tables | **v48**, **88** tables (`src/database/schema.ts:4`) |
| `SyncService.ts` **(674L)** | **1841 lines** |
| **153** suites, **1,365+** tests | **206** suites, **1635** tests |
| project root is `n2/` | root is `JetFarm/` |
| `.env.production` on local disk | **absent** (drives C1/C2) |
| admin `cybergada@gmail.com` | consistent with seed users |

Stale ground truth is what leads an agent to *create* synthetic production env files. Treat as a
real defect with a real blast radius, not cosmetic drift.

---

## 4. Remediation plan

Ordered so each phase is independently shippable and verifiable. Do not batch Phase 1 with anything else.

### Phase 1 — Stop the bleeding (security + deploy integrity)

**1.1 Remove the placeholder encryption key (C1).** In `scripts/export-web-production.mjs:37`, delete
the `|| 'mock-primary-key'` fallback and fail closed:

```js
const key = process.env.EXPO_PUBLIC_ENCRYPTION_KEY || productionVars.EXPO_PUBLIC_ENCRYPTION_KEY;
if (!key) {
  console.error('[export-web-production] EXPO_PUBLIC_ENCRYPTION_KEY is required. Refusing to build.');
  process.exit(1);
}
```

*Best-practice rationale:* a build pipeline must never invent a secret. Loud failure at export time
is strictly better than silent weak crypto in the field, and it makes the missing `.env.production`
surface as C1's symptom instead of a hidden cause.

**1.2 Harden `EncryptionService` against a reused/known key (C1).** Keep `encrypt()` returning `null`
on empty key, but escalate: add a `DEV`-only warn and a production-path hard error, and reject a
denylist of known-placeholder values (`mock-primary-key`, `POSCursor_Sec_2024_Ph`) so a test fixture
can never re-enter a production bundle. Long-term: move to per-device keys via `expo-secure-store` +
server-side envelope encryption — a client-inlined `EXPO_PUBLIC_*` key is discoverable by
construction, since Expo bakes all `EXPO_PUBLIC_` vars into the JS bundle.

**1.3 Guard the deploy env reads (C2).** In `scripts/deploy-cloudflare.mjs:79` and `:246`, hoist a
single `assertProductionEnv()` that `existsSync`-checks and validates required keys **before** any
upload begins, and make the APK/`version.json` pair atomic (manifest first, or roll back the APK).

*Best-practice rationale:* partial publishes are the failure mode operators cannot recover from
mid-flight; validation must precede mutation.

**1.4 Create the real `.env.production`** (gitignored — `.gitignore:39` `.env*` already excludes it;
confirm with `git check-ignore -v .env.production`) and correct the `AGENTS.md` claims from C8 so the
documented and actual runbook match.

**1.5 Gate quick-login to fail closed (C7).** Default to disabled unless explicitly `'true'`, and in
`getQuickLoginUsers()` return `[]` when `isLocalWebE2E()` is false regardless of the flag. Update
`AuthService.test.ts:107-134` expectations as part of the same commit and add a test asserting the
unset case yields `false`.

**Verification:** `npx jest src/services/__tests__/EncryptionService.test.ts
src/services/__tests__/AuthService.test.ts`; dry-run `node scripts/export-web-production.mjs` with the
key unset and confirm a non-zero exit; grep the fresh bundle for every placeholder value → 0 matches.

### Phase 2 — Fix the invisible UI defect at the component layer (C4)

Do **not** hand-edit 101 call sites. Instead:

1. Introduce a shared `AppTextInput` (and `AppSearchBar`) wrapper in `src/components/` that sets
   `placeholderTextColor="#9CA3AF"`, `text-gray-900`, and dark-mode-safe variants once.
2. Migrate call sites incrementally, highest-risk money-entry forms first: `app/login.tsx`,
   `app/register.tsx`, `(admin)/loans/new.tsx`, `(admin)/borrowers/new.tsx`, `(cashier)/pos.tsx`,
   then the accounting module.
3. Enforce permanently with a lint rule so the convention cannot silently decay again — a custom
   ESLint rule (or `no-restricted-syntax` on JSXOpeningElement for `TextInput` outside the wrapper).

*Best-practice rationale:* encode invariants in the type/lint layer, not in prose. 101 violations is
evidence the convention was unenforceable; fixing files without adding the rule guarantees regression.

### Phase 3 — Make the static gates mean something (C3, C5)

**3.1 Console/PII (C3).** Add an ESLint `no-console` (warn → error) plus a single gated logger in
`src/utils/` that no-ops in production, then sweep the 19 identity-leaking calls first and strip the
remaining 576 in module-sized batches. Redact emails/UUIDs unconditionally.

**3.2 Types (C5).** Migrate to `strict: false` → per-flag opt-in in dependency order
(`noImplicitAny`, then `strictNullChecks`, then full `strict`), budgeting the ~1600 `any` sites by
directory. Start where correctness is financial: `LoanCalculatorService`, `PaymentService`,
`MfiKpiService`, `KpiCalculator`, `CooperativeFundService`, then `AuthService`
(`getQuickLoginUsers(): Map<string, any>` → a declared `QuickLoginUser`).

*Best-practice rationale:* strict-mode flags fail 100s of files at once; enabling one flag at a time
with a directory-scoped allowlist keeps CI green and reviews reviewable.

### Phase 4 — Schema reproducibility (C6)

De-duplicate the three migration pairs: collapse each to the later timestamp, keep the earlier as a
no-op marker only if a deployed database already recorded it, and add a CI check asserting (a) unique
migration basenames and (b) every `remoteTableMap` target exists in `CREATE TABLE` coverage — the
exact one-liner from this audit, promoted into `scripts/` as a guard test alongside
`schemaContracts.regression.test.ts`.

**Verification:** `supabase db reset` against a clean instance must reach the same schema the
contract expects; `NOTIFY pgrst, 'reload schema'` present in every policy/DLL migration.

---

## 5. Priority matrix

| # | Defect | Severity | Blast radius | Effort | Phase |
|---|---|---|---|---|---|
| C1 | placeholder AES key in prod builds | Critical | all encrypted sensitive records | S | 1 |
| C2 | deploy crash / partial publish | High | installer distribution | S | 1 |
| C7 | quick-login fail-open + enumeration | Medium* | login surface | S | 1 |
| C3 | PII in console | High | every web user | M | 3 |
| C4 | 101 TextInput a11y violations | Medium | most forms | M (L if per-file) | 2 |
| C5 | 1617 `any` + non-strict tsc | Medium | latent runtime bugs | L | 3 |
| C6 | duplicate migrations | Medium | fresh/prod replay parity | S | 4 |
| C8 | stale `AGENTS.md` | Low/Med | misleads automation | S | 1 |

\* downgraded from Critical because no auth bypass exists — see C7's verified limiter.

## 6. Standing guardrails to add

- CI job that fails on: placeholder secret in any built artifact, duplicate migration basenames,
  `readFileSync` of an env file without a preceding `existsSync`, and unresolved `remoteTableMap`
  targets.
- `no-console` as `error` for `src/services/**` and `app/**`.
- Contract test asserting `EXPO_PUBLIC_*` never carries a key/secret name (client-inlined by design).

## 7. Out of scope / not defects

Sync correctness (88/88 verified), arbitrary Tailwind colors (0), hardcoded source secrets (none),
the single intentional empty `catch` in `AppUpdateService`, and the 1635-test suite itself — which is
the strongest asset in this repo and the reason several of my initial suspicions resolved as clean.

---

## 8. Implementation record — Phase 1 (2026-09-26)

### Shipped and verified

| Finding | Change | Verification |
|---|---|---|
| **C1** | `scripts/export-web-production.mjs` — removed the `\|\| 'mock-primary-key'` fallback; added `resolveEncryptionKey()` which exits non-zero on a missing key **or** a known placeholder, and validates the on-disk `.env.production` too (so a bad key cannot arrive via the file either). Moved the log line after validation so it never claims to write a file it then rejects. | 4 scenarios run: no URL → exit 1; URL but no key → exit 1; `mock-primary-key` → exit 1; **valid operator key → passes the guard and exports successfully**. Asserted no `.env.production` written in any rejecting case. |
| **C1b** | `src/services/EncryptionService.ts` — added a `KNOWN_PLACEHOLDER_KEYS` denylist via `resolveSecret()`, gated on `NODE_ENV !== 'test'` so Jest fixtures keep working. | 3 new tests in `EncryptionService.test.ts`: both committed fixtures refuse to encrypt, and an operator-provisioned key still round-trips. Suite: 10/10. |
| **C2** | `scripts/deploy-cloudflare.mjs` — hoisted a single fail-fast `existsSync` check plus one shared `getProductionEnv()`/`supabaseUrl`/`supabaseKey` resolution **before** version sync and the APK build; replaced both unguarded `readFileSync('.env.production')` sites. `version.json` upload failure is now an **error with `process.exitCode = 1`** instead of a `console.warn`, since a stale manifest beside a new APK is a broken release. | Guard fires and reaches **0** deploy steps (grep for `Step 0\|Step 1\|Compiling Android` → 0). |
| **C8** | `AGENTS.md` — schema v48/88 tables, 206 suites/1635 tests, root `JetFarm/`, and a rewritten ENVIRONMENT section stating `.env.production` is **absent** and must be operator-provisioned; documents the denylist and both fail-fast guards. `src/AGENTS.md` and `src/services/AGENTS.md` corrected likewise. | Cross-checked against `src/database/schema.ts:4` and the Jest run. |

### Full gate result after changes

| Gate | Before | After |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | **exit 0** |
| `npm run lint` (`expo lint`) | exit 0 | **exit 0** |
| `npx jest --no-coverage` | 206 / 1635 | **206 / 1638, all pass** |

### Deliberately not done

**C7 (quick-login fail-open) — deferred as a product decision, not a bug fix.**
The fail-open is *intentional and documented by its own test title*:
`AuthService.test.ts:129` reads *"returns true in production by default when no explicit override is
set."* Flipping it removes the admin quick-access buttons from the deployed login screen, which may
be a workflow the operator relies on. Two further findings lowered its severity:

1. `getQuickLoginUsers()` in a non-test build filters to `E2E_TEST_USERS` (`AuthService.ts:361`), so
   it enumerates ~11 **hardcoded seeded** accounts, not real staff records.
2. Those same emails are *already* in the shipped bundle as the `E2E_TEST_USERS` object literal, so
   the flag governs UI affordance, not disclosure. The disclosure I originally described is
   therefore largely moot.

Decision left to the operator: keep the convenience, or fail closed and update three tests.

**`.env.production` was not created.** It needs genuine production credentials. Fabricating it would
recreate C1 in a new form, so the scripts now fail loudly until the operator provisions it.

### Working-tree caveat

`dist/` was wiped by the bounded production-export test (Metro `--clear`) and rebuilt with
`npx expo export --platform web` → 59 files, exit 0, verified free of every placeholder and of the
temporary test key. It is gitignored/untracked. The rebuilt bundle does contain the denylist literals
as `new Set(['mock-primary-key','POSCursor_Sec_2024_Ph'])` — expected, and confirmed to be the
denylist rather than an inlined key (`EXPO_PUBLIC_ENCRYPTION_KEY` compiles to `void 0` locally).

`.env.local` was backed up and verified **byte-identical** (md5 `866f15d2…`) afterward; `.env.production`
was removed. Nothing was committed — the working tree already held extensive unrelated changes.

---

## 9. Live deployment verification (2026-09-26) — C1 never shipped

Performed to settle whether C1 was latent or already exposed in production.

### Both documented production endpoints do not exist

| Endpoint (`AGENTS.md` "DEPLOYMENT & PRODUCTION") | Google 8.8.8.8 | Cloudflare 1.1.1.1 | Quad9 9.9.9.9 | Server-side fetch |
|---|---|---|---|---|
| `jetfarm.pages.dev` | **NXDOMAIN** | **NXDOMAIN** | **NXDOMAIN** | `fetch failed` |
| `jetfarm-placeholder-db.supabase.co` | **NXDOMAIN** | — | — | — |

Method notes: three independent public resolvers were queried directly, which bypasses this host's
filtering resolver (`familyshield.sse.cisco.com`) — so the negative is authoritative, not local
censorship. Controls passed: the `pages.dev` apex resolves, a real `supabase.com` host resolves, and
general egress works (`example.com` → HTTP 200). DoH was unavailable (the network TLS-intercepts,
`SEC_E_UNTRUSTED_ROOT`), hence the `nslookup @server` approach.

### Consequences

1. **C1 is latent, not an incident.** No artifact built by `export-web-production.mjs` is reachable at
   the documented URL, so no member financial data has ever been encrypted under `mock-primary-key`
   in a deployed system. **No key rotation or breach response is required.** The Phase 1 fix remains
   correct and is now a pre-deploy gate rather than remediation of live exposure.
2. **The `AGENTS.md` production section is aspirational, not descriptive.** It names a database ref
   literally called `jetfarm-placeholder-db` as the production Supabase project. Combined with the
   absent `.env.production`, this repo currently has **no verifiable production deployment**.

### New findings from this pass

**C9 — MEDIUM: the version-manifest fallback URL is identical to the primary.**
`scripts/sync-version.mjs:68-69` writes `PRIMARY_VERSION_URL` and `FALLBACK_VERSION_URL` as the same
string (`https://jetfarm.pages.dev/version.json`), mirrored in `src/constants/AppVersion.ts:11-12`.
`AppUpdateService.ts:93-95` loops `[PRIMARY, FALLBACK]` as a redundancy mechanism, so the retry
re-requests the identical dead host and the fallback buys nothing.
*Fix:* point the fallback at a genuinely independent origin (e.g. the Supabase Storage CDN
`version.json` that `deploy-cloudflare.mjs` already uploads), and add a regression test asserting
`PRIMARY !== FALLBACK` — `src/constants/__tests__/AppVersion.test.ts:22` currently pins the duplicate.

**C10 — HIGH (operations): in-app update and APK download targets are dead.**
`src/constants/AppVersion.ts:8-9` and `AppUpdateModal.tsx:56` hardcode `jetfarm.pages.dev/download`,
which does not resolve. Any installed APK performing an update check today fails both attempts, and
the "update available" path hands users a broken download link. `deploy-cloudflare.mjs:255-256` bakes
the same dead URLs into the published `version.json`.
*Fix:* these URLs must derive from the actual provisioned project rather than a hardcoded constant,
and should fail with an operator-visible error instead of the silent `catch {}` at
`AppUpdateService.ts:118`.

### Revised priority

C9/C10 are now the top of the remaining queue — above tasks 6 and 7 — because they block a working
first deploy, whereas the C4/C3 work is quality debt on an app that has no live users yet.
Recommended order: provision real `.env.production` + Cloudflare Pages + Supabase projects (task 5)
→ fix the URL single-source-of-truth (C9/C10) → then Phases 2–4.

---

## 10. Second implementation pass (2026-09-26) — C9/C11 fixed, C4 withdrawn

### C4 is withdrawn as a false positive

`AGENTS.md` documents the `placeholderTextColor` rule as preventing a "white-on-white dark mode bug".
That failure mode **cannot occur in this app**:

- `app.json:8` → `"userInterfaceStyle": "light"` (pinned)
- `dark:` Tailwind variants across `app/` + `src/`: **0**
- `useColorScheme` / `Appearance` / `setColorScheme` usages: **0**
- `prefers-color-scheme` / `color-scheme` in `global.css`, `index.html`, `public/`: **none**

The 101-file count was correct, but it measured conformance to a convention whose motivating defect
does not exist. Executing Phase 2 as written — a shared `AppTextInput` wrapper, a 101-file migration,
and a new lint rule — would have been a large, genuinely risky refactor delivering **zero**
user-visible improvement. Closed with no code change; reopen only if dark mode is actually enabled.

This is the third instance in this audit where a premise inherited from documentation or a naive scan
dissolved under verification (after the `dist/` key claim and the `app_`-prefixed table diff). The
counting was never the problem; the inferred *consequence* was.

### C9 — fixed: the version-manifest retry had no redundancy

`FALLBACK_VERSION_URL` was byte-identical to `PRIMARY_VERSION_URL`, so the
`[PRIMARY, FALLBACK]` loop at `AppUpdateService.ts:93-95` re-requested the same host and recovered
nothing. The fallback now targets the Supabase public `downloads` bucket that
`deploy-cloudflare.mjs` already mirrors `version.json` into, resolved through the existing
`getRuntimeSupabaseUrl()` so it also honours the Android-emulator `127.0.0.1 → 10.0.2.2` mapping
rather than duplicating that logic.

Wrote the tests first and confirmed **RED for the correct reasons** —
`Expected: not "https://jetfarm.pages.dev/version.json"` — before implementing.

### C11 — new: frozen schema literal misreported the build

`WATERMELONDB_SCHEMA_VERSION` was hardcoded to `25` while `src/database/schema.ts:4` is at `48`, so
`getFullReleaseString()` rendered "Schema v25" in the release footer. Now `48`, with a regression test
that reads the live value out of `schema.ts` so the two cannot silently diverge again.

### The fix that actually mattered: patching the generator

Both defects lived in `src/constants/AppVersion.ts`, but that file is **machine-generated** by
`scripts/sync-version.mjs`, whose template literal hardcoded `= 25` and the duplicate URL. Editing
only the generated file would have meant `npm run deploy:cloudflare` (which runs
`sync-version.mjs --bump`) silently reverted both fixes on the next release.

The generator now derives `schemaVersion` from `schema.ts` — exiting `1` if it cannot read it, rather
than defaulting — and emits the corrected URL block. Verified **idempotent**: after running it,
`AppVersion.ts` is byte-identical to the hand-fixed version and `package.json` / `app.json` are
unchanged. Had I not checked this, the audit's headline fix would have been self-erasing.

### Gate result after this pass

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` (`expo lint`) | **exit 0** |
| `npx jest --no-coverage` | **206 suites / 1640 tests, all pass** (1635 → 1638 → 1640) |

### Remaining

C10's dead `jetfarm.pages.dev` download constants stay unfixed deliberately: pointing them at a real
host requires the Cloudflare Pages project to exist (task 5), and guessing a subdomain would just
replace one dead constant with another.

> **Overturned on 2026-09-27 by §11.** A real deployment does exist — just not on Cloudflare. That made
> the host knowable rather than guessable, so C10 was fixed.





---

## 11. Third pass — the deployment target was real all along, and C10 is fixed (2026-09-27)

### 11.1 §9's central premise was wrong

§9 concluded "nothing is deployed" because the two endpoints named in `AGENTS.md` do not resolve. That
inference was wrong: `AGENTS.md` documents the *Cloudflare* pipeline, which was abandoned, while
production actually runs on the Hetzner box referenced by `.env.hetzner`. Probing that host:

| Endpoint | Result | Interpretation |
|---|---|---|
| `https://jetfarm.818.quest` | **200**, Expo/Metro bundle (9.0 MB) | Live JetFarm web app |
| `https://supabase.818.quest/rest/v1/` | **401** | Live self-hosted PostgREST/Kong, correctly rejecting anon-only |
| Both names | resolve to **`46.225.190.206`** | Same VPS as `deploy-hetzner.bat` |
| `https://jetfarm.818.quest/version.json` | **200 `text/html`, 1400 B** | SPA catch-all — no manifest exists |
| `https://jetfarm.818.quest/download` | **302** → `/download/jetfarm-latest.apk` | **which is 404** |
| `.../storage/v1/object/public/downloads/…` | **400** `{"error":"Bucket not found"}` | No `downloads` bucket on the self-hosted stack |

The live bundle contains `"Agri-One"` and `"JetFarm"`, and hardcodes `https://supabase.818.quest` —
confirming it was built from `.env.hetzner`. Brand drift is still uncommitted: `HEAD:app.json` is
`"name": "Agri-One"` / `"slug": "agri-one"`, the working tree renames it to `JetFarm` / `jetfarm`.

**Net effect:** APK delivery and in-app update checks are **entirely non-functional in production** —
not hypothetically, and not because of DNS.

### 11.2 C10 fix — one resolved origin instead of four dead literals

`src/constants/AppVersion.ts` now derives every release URL from `resolvePublicAppUrl()`:

1. `EXPO_PUBLIC_APP_URL` (build-time override, scheme-validated) — wins, so native APK builds can pin
   the real host explicitly;
2. `window.location.origin` on web — so preview deploys and localhost stay self-consistent;
3. `PRODUCTION_APP_URL = 'https://jetfarm.818.quest'` — the verified live origin.

`httpOnly()` rejects `null`, `file://`, and scheme-less typos, so a misconfiguration degrades to a
working default instead of shipping `jetfarm.818.quest/download` with no scheme.

`APP_DOWNLOAD_URL`, `APP_VERSIONED_DOWNLOAD_URL` and `PRIMARY_VERSION_URL` are derived from it;
`AppUpdateService`'s `PRIMARY_VERSION_URL.replace('/version.json', '/download')` inherits the fix for
free. `AppUpdateModal.tsx:56`'s hardcoded fallback literal now imports `APP_DOWNLOAD_URL`.

### 11.3 Generator and deploy-script reverts, again

`sync-version.mjs` regenerates `AppVersion.ts` on every deploy, and `deploy-cloudflare.mjs` writes the
`apkUrl` / `apkLatestUrl` fields of `version.json` — both hardcoded the dead host, so either would have
silently undone §11.2. Both were patched; `deploy-cloudflare.mjs` now prefers the actually-uploaded
`apkRedirectUrl` and falls back to `EXPO_PUBLIC_APP_URL`.

Idempotency was verified by running `node scripts/sync-version.mjs` and diffing: the only change was a
comment that still named the dead domain (removed from the template so the guard can stay strict).
The generator's output is now the committed truth.

`src/constants/__tests__/AppVersion.test.ts` adds five tests, including a source-scan guard asserting
neither release script mentions the dead host and both mention the live one — the same trap that made
C9/C11 self-erasing.

### 11.4 Gate result

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` (`expo lint`) | **exit 0** |
| `npx jest --no-coverage` | **206 suites / 1645 tests, all pass** (1640 → 1645) |

### 11.5 What code cannot fix (operator/server actions)

1. **No `version.json` on the live host.** `deploy-hetzner.mjs` ships `dist/` but never generates a
   manifest, and nginx's SPA fallback answers `/version.json` with `index.html`. The update checker
   therefore throws on `.json()`, silently swallows it, and falls through to a bucket that does not
   exist. Either emit `version.json` into `dist/` in the Hetzner pipeline, or create the `downloads`
   bucket on the self-hosted Supabase.
2. **No APK is published.** `/download` redirects to a 404. The Gradle build + upload lives only in the
   Cloudflare path, which is not the path being deployed.
3. **`.env.local` is overwritten with production secrets mid-export** (`deploy-hetzner.mjs:127`) and
   restored in `finally`. A kill between those two leaves production credentials in a file a developer
   expects to be disposable.
4. **`rm -rf site/*` runs remotely before extraction** (`deploy-hetzner.mjs:185`) — the site is briefly
   empty and a failed extraction leaves it empty.
