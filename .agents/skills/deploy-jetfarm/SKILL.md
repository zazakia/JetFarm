---
name: deploy-jetfarm
description: Master skill for QA verification, building, and deploying both the JetFarm Web App (Cloudflare Pages) and Android APK Installer (Supabase Storage CDN) with automated version bumping and branding synchronization on every deploy.
---

# JetFarm Deployment Guide: Web App & Android APK Installer

Master guide for zero-regression verification, automated version bumping, branding synchronization, and simultaneous deployment of **both** the **Web App** (Cloudflare Pages `https://jetfarm.pages.dev`) and the **Android APK Installer** (Supabase CDN `https://jetfarm.pages.dev/download`) on every deploy.

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
   Ensure no untracked artifacts or temporary files are cluttering the project root (follow Clean Root Policy).

---

## 2. Zero-Regression Quality Assurance Gates

All steps below must pass cleanly (100% green). If any check fails, fix the underlying issue before proceeding.

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
Run the complete unit test matrix:
```powershell
# Fast run (skips coverage overhead)
npx jest --no-coverage
```

### Gate 2.5: Design & A11y Standards Check
- **No Arbitrary Hex Colors**: Confirm all styling uses standard Tailwind classes (e.g. `bg-blue-900`, `text-emerald-500`). Arbitrary hex colors (`bg-[#...]`) break NativeWind v4 on web/native.
- **TextInput Contrast**: Confirm `<TextInput>` components have explicit `placeholderTextColor="#9CA3AF"` and dark text classes (`text-gray-900`) to prevent white-on-white text bugs.
- **PHP Currency Compliance**: Ensure currency display strictly uses `formatPHP()` or `₱` format across all screens.
- **Branding & Version Number Display**: Confirm `AppLogo`, `SidebarContent`, `login.tsx`, and download CTAs display the live application version (`v{getAppVersion()}`).

### Gate 2.6: Database Schema Migrations & Status Check
Check for pending database schema migrations before building or deploying:
```powershell
# 1. Dry run / status check of pending Supabase migrations on production database
npm run db:migrate

# 2. Verify schema columns, constraints, and tables match live database
npm run db:migrate:verify

# 3. If there are pending migrations, apply them carefully:
npm run db:migrate:apply
```

### Gate 2.7: WatermelonDB ↔ Supabase Sync Contract
Verify sync schema registration and production table mapping:
```powershell
# 1. Schema contract regression test
npx jest src/database/schemaContracts.regression.test.ts

# 2. Live production sync integrity check (read-only verification)
node scripts/verify-sync-integrity.mjs --production
```

### Gate 2.8: Double-Entry Accounting & Financial Parity
- Verify that `chart_of_accounts`, `journal_entries`, and `journal_entry_lines` are mapped in `src/services/syncTableContract.json`.
- Ensure all business unit operations trigger balanced debit/credit entries.
- Verify PostgreSQL database trigger `trg_enforce_balanced_journal` is active on Supabase to reject unbalanced journals.

### Gate 2.9: Playwright E2E Test Suite
Run automated browser tests simulating real operations:
```powershell
npm run test:e2e
```

---

## 3. Production Deployment: Web App + Android APK Installer

On **every deploy**, the pipeline compiles and deploys **both** the Web App and the Android APK Installer, and synchronizes the version number across all files and branding components.

### Execute Deployment

```powershell
npm run deploy:cloudflare
```

### Automated Steps Executed on Every Deploy

1. **Automated Version Increment & Synchronization (`scripts/sync-version.mjs --bump`)**:
   - Bumps the semantic patch version (e.g. `0.1.0` → `0.1.1`).
   - Increments Android `versionCode` (e.g. `1` → `2`).
   - Synchronizes `package.json`, `app.json`, and `src/constants/AppVersion.ts` atomically.
   - Refreshes in-app release updates via `scripts/generate-app-updates.mjs`.

2. **Android APK Compilation (`scripts/build-android-production.mjs`)**:
   - Runs `expo prebuild --platform android --no-install`.
   - Compiles production release binary via Gradle: `gradlew app:assembleRelease`.
   - Outputs APK artifact under `android/app/build/outputs/apk/release/`.

3. **Supabase Storage CDN APK Upload**:
   - Locates compiled release APK binary.
   - Uploads binary directly to Supabase Storage bucket `downloads` as `jetfarm.apk`.
   - Cleans up historical obsolete versioned APKs in the bucket to prevent storage bloat.
   - Obtains public direct download URL: `${EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/downloads/jetfarm.apk`.

4. **Web Application Export (`scripts/export-web-production.mjs`)**:
   - Bundles the React Native web application into `dist/`.
   - Bakes in the freshly updated version number, ensuring all branding components (`AppLogo`, `SidebarContent`, `login.tsx`) display the new version number.

5. **SPA Client-Side Routing & Download Page Generation**:
   - Generates `dist/_redirects` mapping:
     - `/download` → Supabase CDN APK URL (302)
     - `/download/latest` → Supabase CDN APK URL (302)
     - `/download/apk` → Supabase CDN APK URL (302)
     - `/download/v*` → Supabase CDN APK URL (302)
     - `/jetfarm.apk` → Supabase CDN APK URL (302)
     - `/* /index.html 200`
   - Generates a static HTML fallback download page at `dist/download/index.html` displaying `JetFarm Mobile App`, version badge, release details, and direct APK download button.

6. **In-App Updater Manifest Generation**:
   - Generates `dist/version.json` with `latestVersion`, `versionCode`, `releaseTag`, `apkUrl`, and `releaseNotes`.
   - Uploads fallback `version.json` to Supabase Storage `downloads` bucket.

7. **Security & CSP Headers (`dist/_headers`)**:
   - Writes Content Security Policy and anti-clickjacking security headers.

8. **Asset Name Sanitization**:
   - Renames `dist/assets/node_modules/` to `dist/assets/vendor_modules/` to bypass Cloudflare Pages' ignore filter for vector icons and fonts.

9. **Cloudflare Pages Edge Deployment**:
   - Executes `npx wrangler pages deploy dist --project-name jetfarm --branch main --commit-dirty=true`.

---

## 4. Branding & Version Number Display

The version number is automatically updated on every deploy and displayed across key branding locations:

1. **`src/components/AppLogo.tsx`**:
   - Renders company name `JetFarm` alongside a prominent emerald badge `v{getAppVersion()}` (e.g. `v0.1.1`).
   - Displayed in the Admin Sidebar, Borrower Portal Header, and Dialogs.

2. **`src/components/SidebarContent.tsx`**:
   - Top Header: Displays `AppLogo` with live version badge.
   - Bottom Footer: Displays `JetFarm v{getAppVersion()} • Build {APP_BUILD_NUMBER}` with a direct **"Download Latest APK"** link.

3. **`app/login.tsx`**:
   - Hero Header: Displays `JetFarm AGRIBUSINESS OS • v{getAppVersion()}`.
   - Download Button: Displays `Download Android APK (v{getAppVersion()})` linking to `APP_DOWNLOAD_URL`.
   - Login Footer: Displays `JetFarm v{getAppVersion()} - SECURE ACCESS`.

4. **`app/(admin)/settings/updates.tsx`**:
   - In-app update manager showing current installed version, build number, and checks for updates.

---

## 5. Post-Deployment Verification & Smoke Testing

Immediately after running `npm run deploy:cloudflare`:

1. **Verify Live Web Endpoint**:
   - Navigate to `https://jetfarm.pages.dev`
   - Check that the branding shows the newly deployed version badge (e.g. `v0.1.1`).
   - Check browser console for 0 errors/404s.

2. **Verify APK Installer Download Endpoint**:
   - Navigate to `https://jetfarm.pages.dev/download`
   - Confirm automatic redirect or download prompt for `jetfarm.apk`.
   - Inspect fallback download page to confirm displayed version matches.

3. **Verify Version Manifest**:
   - Navigate to `https://jetfarm.pages.dev/version.json`
   - Verify `latestVersion` and `versionCode` match the deployed build.

4. **Verify Admin Authentication**:
   - Log in with production admin user: `cybergada@gmail.com`.
   - Verify dashboard metrics render correctly with `₱` currency.
   - Verify sidebar displays the updated version number in the branding and footer.

5. **Verify WatermelonDB Sync Engine**:
   - Open Sync Center and perform a sync test.

---

## 6. Team Notification

Once verification passes, post deployment summary:

```markdown
### 🚀 JetFarm Production Deployment (Web & Android APK)
- **Web App**: https://jetfarm.pages.dev (Version: v[VERSION], Build: [BUILD_NUMBER])
- **APK Installer Download**: https://jetfarm.pages.dev/download
- **Version Manifest**: https://jetfarm.pages.dev/version.json
- **Branding**: Version badge v[VERSION] active across Web App and Mobile APK
- **Commit**: [GIT_HASH]
- **Status**: Deploy na Mimi at [Current Date]
```
