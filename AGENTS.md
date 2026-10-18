# PROJECT KNOWLEDGE BASE

**Generated:** 2026-08-19 00:10
**Verified:** 2026-09-26 (against commit `35bef44` — see `docs/BUG-AUDIT-AND-REMEDIATION-PLAN.md`)
**Branch:** main

## OVERVIEW
JetFarm - An enterprise management, POS, and agricultural operations system built with Expo (React Native). Offline-first architecture using WatermelonDB for local persistence and Supabase for cloud sync + auth. Serves multi-role operational and administrative workflows.

## STRUCTURE
```
JetFarm/
├── app/               # Expo Router screens (file-based routing, 90+ files)
├── src/               # Source code (175+ files)
│   ├── components/    # Reusable UI components (35+)
│   ├── services/      # Business logic services (25+)
│   ├── database/      # WatermelonDB schema + models (14 + 19 models)
│   ├── hooks/         # Custom React hooks (5)
│   ├── modules/       # MPCo business unit modules (water-station, agri-store, pharmacy, transport)
│   ├── store/         # Auth context + Zustand stores (2)
│   ├── stores/        # Zustand stores (2)
│   └── utils/         # Utility functions (14)
├── scripts/           # Operational/utility/audit scripts (140+)
├── supabase/          # Supabase config, migrations, seed, and queries
│   ├── migrations/    # Schema change migrations
│   └── queries/       # Raw SQL debugging/utility scripts
├── tests/             # Playwright E2E tests (20+)
├── docs/              # Project documentation, guides, and manuals
│   └── examples/      # Integration/dashboard example templates
└── .agents/           # Agent skills + workflows
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add a screen/page | `app/(role)/` | Follow existing file-based routing pattern |
| Add a service | `src/services/` | Business logic, extends BaseModelService |
| Add a coop module | `src/modules/` | Implement module manifest and register in `src/modules/registry.ts` |
| Add a database model | `src/database/models/` | WatermelonDB model, must add to schema.ts |
| Add a reusable component | `src/components/` | React Native + NativeWind |
| Add a test | `src/services/__tests__/` | Jest unit |
| Add E2E test | `tests/` | Playwright |
| Modify Supabase schema | `supabase/migrations/` | |

## CODE MAP
| Symbol | Type | File | Role |
|--------|------|------|------|
| RootLayout | component | `app/_layout.tsx` | Auth provider + navigation stack |
| AuthProvider | context | `src/store/AuthContext.tsx` | Auth state management |
| database | singleton | `src/database/index.ts` | WatermelonDB init |
| supabase | singleton | `src/database/supabase.ts` | Supabase client |
| synchronize | function | `src/services/SyncService.ts` | WDB ↔ Supabase sync engine |
| mySchema | schema | `src/database/schema.ts` | DB schema definition (v48, 88 tables) |
| ModuleRegistry | singleton | `src/modules/registry.ts` | Multi-Purpose Coop module registry |

## CONVENTIONS
- Currency is strictly Philippine Peso (`PHP` / `₱`) using `formatPHP()`
- File-based routing via Expo Router route groups: `(admin)/`, `(borrower)/`, `(collector)/`, `(expenses-encoder)/`
- WatermelonDB models with decorators (`@field`, `@date`, `@relation`)
- UUID v4 for all record IDs (set in `database/index.ts`)
- `deleted_at` timestamp on most models for soft-delete
- NativeWind for styling (`className` props). **NO arbitrary hex colors** (`bg-[#...]`, `text-[#...]`). Use standard Tailwind classes.
- **TextInput Accessibility**: Always explicitly specify `placeholderTextColor="#9CA3AF"` and text color classes (`text-gray-900`) on `<TextInput>` to prevent white-on-white dark mode bugs.
- Services: classes with static methods
- `camelCase` for files (services, utils); `PascalCase` for components and models
- Tests co-located in `__tests__/` within each module
- **Clean Root Policy**: Keep the project root directory completely clean.
  - Save markdown documents under `docs/`.
  - Save utility/diagnostic/import scripts (js, mjs, py, ps1, etc.) under `scripts/`.
  - Save ad-hoc/utility SQL queries under `supabase/queries/`.
  - Save design mockups, images, and visual assets under `docs/images/` or within component subdirectories.

## TDD & TESTING
- **RED-GREEN-REFACTOR**: Write failing test first, then code, then refactor. No production code without a failing test.
- **Test runner**: Jest (jest-expo preset), 206 suites, 1635 tests (100% passing)
- **Commands**:
  - `npm test` — run all unit tests
  - `npm run lint` — ESLint flat config check (`eslint.config.js`)
  - `npx jest --no-coverage` — faster run without coverage
  - `npx jest <path>` — targeted test file
  - `npm run test:e2e` — Playwright E2E tests
- **QA Pipeline**: BryV3 (30 quality gates across 10 phases) via `C:/Users/HI/.gemini/config/skills/BryV3/scripts/run_bry.mjs`

## ANTI-PATTERNS
- Never target production Supabase from tests (see playwright.config.ts safety check)
- Never disable the decorator pipeline - required for WatermelonDB
- Never use inline styles when className works (except for dark background style fallbacks in Animated.View)
- Avoid direct mutations on WatermelonDB records (use `prepareCreate`/`prepareUpdate`)
- **Never create files in the project root**: Always place them in their respective categorized subfolders.

## COMMANDS
```bash
npm start              # Expo dev server
npm run web            # Expo web preview
npm run test           # Jest unit tests
npm run test:e2e       # Playwright E2E tests
npm run android        # Android build
npm run ios            # iOS build
npm run export:web     # Production web export
```

## NOTES
- Custom decorator pipeline in babel (not default expo preset): `babel-plugin-transform-typescript-metadata` + `@babel/plugin-proposal-decorators`
- NativeWind v4 with `withNativeWindFixed` metro patch (avoids ERR_UNSUPPORTED_DIR_IMPORT)
- SyncService maps local table names to remote Supabase table names
- `"strict": false` in tsconfig
- `NODE_ENV=test` disables NativeWind JSX transform in babel config

## DEPLOYMENT & PRODUCTION
- **Canonical release origin**: `https://jetfarm.pages.dev` (Cloudflare Pages project `jetfarm`, account `cybergada@gmail.com`). Verified 2026-10-18: `/version.json` → 200 with `latestVersion 0.1.5`, `/download` → 302 → `https://supabase.818.quest/storage/v1/object/public/downloads/JetFarm-v0.1.5.apk` → 200 (42 MB APK). `PRODUCTION_APP_URL` and every CI workflow bake this host.
- **⚠ Pages asset limit**: a single Pages file caps at 25 MiB, and the release APK is 40.1 MiB (`android/app/build/outputs/apk/release/app-release.apk`, 42,018,169 bytes). The APK therefore cannot be committed as a Pages static asset — `/download` must stay a 302 to Supabase Storage, or move to R2 behind a Worker.
- **Mirrored web app**: `https://jetfarm.818.quest` (self-hosted Hetzner VPS `46.225.190.206`, Caddy → Docker container `jetfarm-app` on `127.0.0.1:8088`, site root `/home/deploy/apps/jetfarm/site`).
- **Live Supabase**: `https://supabase.818.quest` — self-hosted Kong/PostgREST on the same VPS. The `jetfarm-placeholder-db.supabase.co` ref in older docs is a dead placeholder.
- **Deploy Command (real path)**: `npm run deploy:hetzner` → `scripts/deploy-hetzner.mjs`: SSH pre-flight → apply pending migrations via `docker exec supabase-db psql` + `NOTIFY pgrst` → `expo export --platform web --clear` (temporarily swapping `.env.hetzner` over `.env.local`) → tar + scp → `rm -rf site/*` and extract → `docker compose up -d` → append/validate Caddy snippet → probe both domains. Needs a working `hetzner` SSH alias (`HETZNER_SSH_ALIAS` to override; `HETZNER_HOST` is informational only).
- **Schema-only migrations**: `npm run db:migrate` (dry run) / `db:migrate:apply` / `db:migrate:verify` → `scripts/apply-hetzner-migrations.mjs`. Same SSH + `docker exec -i supabase-db psql` path and the same `deploy_schema_migrations` ledger as Stage 2 above, so a full deploy never re-applies what it ran — but it touches no site directory, no bundle and no env file, and it aborts on the first failed migration instead of warning and deploying anyway. Prefer it for pure schema repairs.
- **⚠ Hazard**: `deploy-hetzner.mjs` writes production secrets into `.env.local` for the duration of the export (restored only in `finally`), and empties the remote site directory before extracting. Do not run it unattended, and never kill it mid-export. Its Stage 2 also swallows migration errors (`console.warn` and continue), which is the failure mode `apply-hetzner-migrations.mjs` exists to avoid.
- **Not the release origin**: `https://jetfarm.818.quest` serves the app on Hetzner but publishes no `/download` route (`/download`, `/download/`, `/download/v0.1.5` all 404) and a `version.json` frozen at `0.1.1`, so in-app update links from that host are dead. `deploy-hetzner.mjs` still deploys the site here.
- **Deploy Command (Cloudflare Pages, canonical releases)**: `npm run deploy:cloudflare` → `scripts/sync-version.mjs --bump` + `scripts/deploy-cloudflare.mjs`. Requires `.env.production` (present) and a `wrangler` login; the `jetfarm` Pages project exists in account `cybergada@gmail.com` and deploys with `--project-name jetfarm --branch main`.
- **Known production gap**: the Hetzner pipeline publishes neither `version.json` nor the APK, so `/download` and update checks only work on the Pages origin. Tracked in `docs/BUG-AUDIT-AND-REMEDIATION-PLAN.md` §11.5.
- **Release URLs**: `src/constants/AppVersion.ts` derives every download/update URL from `EXPO_PUBLIC_APP_URL` → `window.location.origin` (web) → `PRODUCTION_APP_URL`. Never reintroduce a hardcoded host.
- **Admin Access**: `cybergada@gmail.com`

## VITERBO FOODS & CRISPY KING INTEGRATION (2026-09-10)
- **Enterprise Accounting**: Added PostgreSQL-level strict double-entry triggers (`trg_enforce_balanced_journal`) to physically block unbalanced `journal_entries` regardless of frontend bugs.
- **Modules Added**: PH Payroll Rules (SSS, PhilHealth, Pag-IBIG), Franchise CRM (Contracts, Royalty Ledger), and HR Device Management.
- **Audit Documentation**: Operational audits and BI deployment plans are located in `docs/crispyking/`.

## ENVIRONMENT & CREDENTIALS CONVENTION
- **Local Development**: Configured in `.env.local`. Note: `.env.local` does **not** define `EXPO_PUBLIC_ENCRYPTION_KEY`, so `EncryptionService` is inactive locally by design (it returns `null` rather than guessing a key).
- **Production Secrets**: `.env.hetzner` is the **operative** Hetzner environment (gitignored via `.env*`) and is consumed by `scripts/deploy-hetzner.mjs`; it defines `EXPO_PUBLIC_SUPABASE_URL`, `_ANON_KEY`, a genuine 32-char `_ENCRYPTION_KEY`, `_BUSINESS_TYPE`, `_ENABLE_QUICK_LOGIN`, `_APP_ENV` and `_APP_URL` (pinned to `https://jetfarm.pages.dev` so native builds never bake the download-less host). `.env.production` is what the Cloudflare scripts require and **is present** in this working copy, with `_APP_URL=https://jetfarm.pages.dev` and `CLOUDFLARE_PROJECT_NAME`.
- **Never print secret values**: report env var *names*, lengths, or denylist classification only.
- **Autonomous Agent Access**: Read `.env.production` from disk when it exists; do not re-ask the user for credentials already stored there. If it is **absent**, stop and request provisioning — never synthesize it from placeholders. `scripts/export-web-production.mjs` and `scripts/deploy-cloudflare.mjs` both fail fast for this reason (a test-fixture AES key in a production build looks like working encryption; a mid-deploy env failure leaves a new APK against a stale `version.json`).
- **Never commit test fixture keys**: `mock-primary-key` and `POSCursor_Sec_2024_Ph` are denylisted and rejected outside Jest.
- **Git Security Guard**: Never track or commit `.env` or `.env.production` files. Run `git check-ignore -v .env.production` to confirm exclusion before committing.
- **Production Endpoints**:
  - Canonical release origin: `https://jetfarm.pages.dev` (`/download`, `/version.json`)
  - Mirrored web app: `https://jetfarm.818.quest` (fallback `https://jetfarm.46.225.190.206.sslip.io`) — no `/download` route
  - Supabase: self-hosted `https://supabase.818.quest` on the same VPS
  - Storage Bucket: `downloads` — **exists** on the self-hosted stack and serves the release APK and the fallback `version.json` (verified 2026-10-18)

## AI AUTOMATION POLICY (2026-10-04)
Full workflow design: `docs/AI-ASSISTED-DEV-WORKFLOW-PLAN.md` (risk tiers L0–L5, rollout phases).

- **Risk tiers**: every change is classified by `scripts/changed-files-gate.mjs` (also `npm run gate`). The reported tier dictates the required verification commands; an agent may not declare a task done without running the tier's gates and leaving evidence under `tmp/systematic-test-matrix/`.
- **Local gates**: husky `pre-commit` runs eslint + Clean Root Policy + `.env` staging block on staged files; `pre-push` runs eslint + `tsc --noEmit` + `jest --findRelatedTests` on the pushed range. Escape hatches `GATE_SKIP_TSC` / `GATE_SKIP_JEST` exist for emergencies only — CI re-runs everything anyway.
- **Human-only commands — agents must NEVER run these autonomously**:
  - `npm run deploy:hetzner`, `deploy:pipeline`, `deploy:cloudflare`, `deploy:staging` (any deploy path)
  - `npm run db:migrate:apply` and `scripts/apply-hetzner-migrations.mjs --apply` against production (dry-run `db:migrate` is allowed)
  - Production data mutations: `scripts/clear-prod-db.mjs`, `scripts/backup-prod-db.mjs`, `create-admin-prod.mjs`, `cleanup-nonhuman-production-borrowers.js`, and any `scripts/*prod*` write path
  - Reading/writing `.env.hetzner` or `.env.production` values (names/classification only, per the credentials convention above)
  - Force-pushes, tag pushes, APK publication to the downloads CDN
- **TDD is enforced on AI output too**: production code must arrive with a demonstrably failing test first (show the RED run in the handoff).
- **Tier L3+/L4 caution**: changes under `src/database/`, `SyncService.ts`, or journal/ledger/Cash services additionally require `npm run check:sync` and `npm run audit:crud:gate` evidence, plus human review — these are data-loss-class surfaces.
- **Self-review**: before handing off any diff, re-check it against the ANTI-PATTERNS section and the Conventions (no arbitrary hex, no inline styles, `placeholderTextColor` on TextInputs, no root files).


