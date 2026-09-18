# PROJECT KNOWLEDGE BASE

**Generated:** 2026-08-19 00:10
**Commit:** 8653845
**Branch:** main

## OVERVIEW
JetFarm - An enterprise management, POS, and agricultural operations system built with Expo (React Native). Offline-first architecture using WatermelonDB for local persistence and Supabase for cloud sync + auth. Serves multi-role operational and administrative workflows.

## STRUCTURE
```
n2/
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
| mySchema | schema | `src/database/schema.ts` | DB schema definition (v25) |
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
- **Test runner**: Jest (jest-expo preset), 153 suites, 1,365+ tests (100% passing)
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
- **Cloudflare Pages URL**: `https://jetfarm.pages.dev`
- **Production Supabase DB**: `jetfarm-placeholder-db`
- **Deploy Command**: `npm run deploy:cloudflare` (Executes Expo Web Export + Wrangler deploy with `_redirects` and `_headers` routing).
- **Admin Access**: `cybergada@gmail.com`

## VITERBO FOODS & CRISPY KING INTEGRATION (2026-09-10)
- **Enterprise Accounting**: Added PostgreSQL-level strict double-entry triggers (`trg_enforce_balanced_journal`) to physically block unbalanced `journal_entries` regardless of frontend bugs.
- **Modules Added**: PH Payroll Rules (SSS, PhilHealth, Pag-IBIG), Franchise CRM (Contracts, Royalty Ledger), and HR Device Management.
- **Audit Documentation**: Operational audits and BI deployment plans are located in `docs/crispyking/`.

## ENVIRONMENT & CREDENTIALS CONVENTION
- **Local Development**: Configured in `.env.local`.
- **Production Secrets**: Stored exclusively on local disk in `.env.production` (strictly gitignored via `.env*`).
- **Autonomous Agent Access**: Agents must read `.env.production` directly from disk for production operations, deployments, and migrations. Never prompt the user to re-paste production credentials if `.env.production` is present.
- **Git Security Guard**: Never track or commit `.env` or `.env.production` files. Run `git check-ignore -v .env.production` to confirm exclusion before committing.
- **Production Endpoints**:
  - Web App: `https://jetfarm.pages.dev`
  - Supabase Project Ref: `jetfarm-placeholder-db` (`https://jetfarm-placeholder-db.supabase.co`)
  - Storage Bucket: `downloads` (public read for APK distributions, service_role write)

