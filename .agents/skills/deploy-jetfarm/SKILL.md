---
name: deploy-jetfarm
description: Master skill for QA verification, building, and deploying the JetFarm app to Cloudflare Pages.
---

# JetFarm QA & Cloudflare Pages Deployment (Expo Router + NativeWind v4)

Master guide for zero-regression verification, asset pipeline compilation, and automated deployment of JetFarm to Cloudflare Pages (`https://jetfarm.pages.dev`) and Supabase Storage CDN.

---

## 1. Pre-Flight Environment & Security Checks

Before starting the build or running quality gates:

1. **Production Environment Secrets**:
   Confirm that `.env.production` is present in the project root and contains valid production keys:
   - `EXPO_PUBLIC_SUPABASE_URL` (`https://jetfarm-placeholder-db.supabase.co`)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` (required for uploading release APKs to the `downloads` storage bucket)
   - `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` (or active `npx wrangler` login)

2. **Git Security Guard**:
   Ensure `.env.production` is strictly excluded from version control:
   ```powershell
   git check-ignore -v .env.production
   ```

3. **Repository Cleanliness**:
   Ensure no untracked artifacts or files are cluttering the project root (follow the Clean Root Policy).

---

## 2. Zero-Regression Quality Assurance Gates

All steps below must pass cleanly (100% green). If any check fails, stop and fix the underlying issue before proceeding.

**Automation preference:** For a single evidence-backed pass of tsc → Jest buckets → full Jest → Playwright → export smoke, run `systematic-test-matrix` (`node .agents/skills/systematic-test-matrix/scripts/run_matrix.mjs`) and read the newest `tmp/systematic-test-matrix/*/summary.json`. Still run lint and any production-only gates below when shipping. For writing/fixing individual Jest tests, use the `testing` skill.

### Gate 2.1: Static Type Check
Verify TypeScript types compile without errors:
```powershell
npx tsc --noEmit
```

### Gate 2.2: ESLint Health Check
Verify lint rules and code conventions:
```powershell
npm run lint
```

### Gate 2.3: Expo Doctor Environment Check
Inspect dependency versions and Expo config compatibility:
```powershell
npx expo-doctor
```

### Gate 2.4: Jest Unit & Integration Test Suite
Run the complete unit test matrix (~193 suites, ~1554 tests):
```powershell
# Full run
npm run test

# Fast run (skips coverage overhead)
npx jest --no-coverage
```

### Gate 2.5: Design & A11y Standards Check
- **No Arbitrary Hex Colors**: Confirm all styling uses standard Tailwind classes (e.g. `bg-blue-900`, `text-red-500`). Arbitrary hex colors (`bg-[#...]`) break NativeWind v4 on web/native.
- **TextInput Contrast**: Confirm `<TextInput>` components have explicit `placeholderTextColor="#9CA3AF"` and dark text classes (`text-gray-900`) to prevent white-on-white text bugs.
- **PHP Currency Compliance**: Ensure currency display strictly uses `formatPHP()` or `₱` format across all screens.

### Gate 2.6: WatermelonDB ↔ Supabase Sync Contract
Verify sync schema registration and production table mapping:
```powershell
# 1. Schema contract regression test
npx jest src/database/schemaContracts.regression.test.ts

# 2. Live production sync integrity check (read-only verification)
node scripts/verify-sync-integrity.mjs --production
```

### Gate 2.7: Double-Entry Accounting & Financial Parity
- Verify that `chart_of_accounts`, `journal_entries`, and `journal_entry_lines` are mapped in `src/services/syncTableContract.json`.
- Ensure all business unit operations (Cash on Hand, Bank, CBU Share Capital, Savings, Expenses, Loans, Payments, Sales Returns) trigger balanced debit/credit entries.
- Verify that the PostgreSQL database trigger `trg_enforce_balanced_journal` is active on Supabase to reject unbalanced journals.
- Check that live financial reports (Balance Sheet, Income Statement, Trial Balance, Cash Flows) accurately reflect all reconciled entries.

### Gate 2.8: Playwright E2E Test Suite
Run automated browser tests simulating real multi-role operations:
```powershell
npm run test:e2e
```

---

## 3. Local Production Build Check

Test web bundling locally to ensure Metro bundler, tree-shaking, and NativeWind CSS extraction succeed:
```powershell
npm run export:web:production
```
*(This script temporarily mounts `.env.production` into the Metro bundler environment and outputs to `dist/`).*

---

## 4. Cloudflare Pages & CDN Deployment

### Deployment Options

#### Option A: Full Release (Web + Android APK + Supabase CDN)
Bumps patch version in `package.json`, compiles Android Release APK, uploads APK to Supabase CDN `downloads` bucket, generates routing configs, and deploys web to Cloudflare Pages:
```powershell
npm run deploy:cloudflare
```

#### Option B: Fast Web-Only Deployment (Skip Android Build)
When changes only affect the web application or documentation, skip the local Android Gradle compilation to deploy within seconds:
```powershell
node scripts/deploy-cloudflare.mjs --skip-apk-build
```

### What Happens During Deployment (`scripts/deploy-cloudflare.mjs`)
1. **Web Export**: Executes `npm run export:web:production` targeting `dist/`.
2. **APK Compilation & CDN Upload**:
   - Compiles APK via Gradle (`android:production`).
   - Uploads binary to Supabase Storage bucket `downloads` as `jetfarm.apk` (latest only) and deletes obsolete `jetfarm-v*.apk` objects.
3. **SPA Client-Side Routing**:
   - Generates `dist/_redirects` mapping `/* /index.html 200`.
   - Adds 302 redirects for `/download`, `/download/latest`, `/download/apk`, and `/jetfarm.apk` pointing to the Supabase CDN URL.
   - Generates static fallback download page at `dist/download/index.html`.
4. **Security & CSP Headers**:
   - Generates `dist/_headers` with Content-Security-Policy (whitelisting production Supabase and `wss://...`), strict frame options, and MIME guards.
5. **Asset Name Sanitization**:
   - Renames `dist/assets/node_modules/` to `dist/assets/vendor_modules/` and updates bundle references. (Cloudflare Pages ignores folders named `node_modules`, which would otherwise break vector icons and fonts).
6. **Wrangler Deploy**:
   - Deploys `dist/` to Cloudflare Pages project `jetfarm` on branch `main`.

---

## 5. Post-Deployment Verification & Smoke Testing

Perform these live health checks immediately after deployment:

1. **Live Web Endpoint**:
   - Visit `https://jetfarm.pages.dev`
   - Check browser devtools console for missing assets (0 console 404s, vector icons load cleanly).
2. **APK Download Endpoint**:
   - Visit `https://jetfarm.pages.dev/download`
   - Confirm automatic redirect or download prompt for the latest Android APK.
3. **Admin Authentication**:
   - Log in with production admin user: `cybergada@gmail.com`.
   - Verify dashboard metrics render correctly with `₱` currency.
4. **WatermelonDB Sync Engine**:
   - Open Sync Center.
   - Trigger a manual sync to verify push/pull connectivity with production Supabase.

---

## 6. Rollback & Troubleshooting Runbook

- **Instant Rollback via Cloudflare Pages**:
  If a critical bug is discovered in production:
  1. Open Cloudflare Dashboard -> Workers & Pages -> `jetfarm` -> Deployments.
  2. Locate the previous healthy deployment and click **Rollback to this deployment**.
  3. Alternatively, use Wrangler:
     ```powershell
     npx wrangler pages deployment list --project-name jetfarm
     ```
- **Vector Icons / Fonts Missing**:
  Confirm that `scripts/deploy-cloudflare.mjs` successfully executed the `assets/node_modules` -> `assets/vendor_modules` renaming step.
- **Supabase Storage Upload Failure**:
  Ensure `SUPABASE_SERVICE_ROLE_KEY` in `.env.production` has write permissions to the `downloads` bucket.
  Only `jetfarm.apk` is retained; deploy deletes obsolete `jetfarm-v*.apk` objects automatically.

---

## 7. Team Notification

Once smoke verification passes, post an update to the active release issue or team thread:

- **Notification Ping**: `Deploy na Mimi at [Current Date]`
- **Deployment Summary**:
  ```markdown
  ### 🚀 Production Deployment Successful
  - **Environment**: Cloudflare Pages (`https://jetfarm.pages.dev`)
  - **Version**: v[VERSION]
  - **Commit**: [GIT_HASH]
  - **APK Download**: https://jetfarm.pages.dev/download
  - **Quality Gates**: All green (TSC, Lint, Jest, E2E, Sync Contracts, Accounting Parity)
  - **Status**: Deploy na Mimi at [Current Date]
  ```
