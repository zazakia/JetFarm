---
description: How to build and deploy JetFarm to Android (APK Installer) and Web (Cloudflare Pages)
---

# Deploy Workflow: JetFarm Web & Android APK

## 1. Pre-Deploy Quality Assurance
Run unit tests and type checks:
```bash
npx jest --no-coverage
npx tsc --noEmit
```

## 2. Verify Production Secrets
Confirm `.env.production` contains valid production keys:
```env
EXPO_PUBLIC_SUPABASE_URL=https://jetfarm-placeholder-db.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<production-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>
```

## 3. Production Deployment (Web App + Android APK)
On every deploy, run:
```bash
npm run deploy:cloudflare
```
This automatically:
1. Bumps and synchronizes version number across `package.json`, `app.json`, and `src/constants/AppVersion.ts`.
2. Compiles Android APK installer for production (`android:production`).
3. Uploads the APK to Supabase Storage CDN `downloads/jetfarm.apk`.
4. Exports the Web App with updated branding version badges (`export:web:production`).
5. Generates SPA routing, fallback download page (`dist/download/index.html`), and in-app update manifest (`dist/version.json`).
6. Deploys Web App to Cloudflare Pages (`https://jetfarm.pages.dev`).

## 4. Post-Deploy Verification
- **Web App**: `https://jetfarm.pages.dev` (confirm version badge in AppLogo branding)
- **APK Installer Download**: `https://jetfarm.pages.dev/download`
- **Version Manifest**: `https://jetfarm.pages.dev/version.json`
