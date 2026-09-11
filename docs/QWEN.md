# POS Cursor (POSCursor) — QWEN Context

## Project Overview

**POS Cursor** (branded as "SCSCC - POS Cursor", package name `com.jetfarm.app`) is an offline-first microfinance/lending management mobile application built with **Expo SDK 55** (React Native). It uses **WatermelonDB** for local SQLite persistence and **Supabase** (PostgreSQL + Auth) for cloud synchronization and authentication.

The app serves **6 user roles** with route-grouped navigation:
- `admin` / `main_office` — full access, financial reporting, KPIs, payroll
- `collector` — field collections, borrower management, remittances
- `borrower` — borrower self-service portal
- `loan_encoder` — loan application encoding and approval workflows
- `payment_encoder` — payment recording and cash management
- `expenses_encoder` — expense recording and categorization

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Expo SDK 55 / React Native 0.83 |
| Language | TypeScript (~5.9.2) |
| Local DB | WatermelonDB 0.27.1 (SQLite native, LokiJS web/test) |
| Backend | Supabase (Postgres + Auth + RLS) |
| Routing | Expo Router (file-based, route groups) |
| State | React Context (auth/session), Zustand (sync telemetry) |
| Forms | React Hook Form + Zod |
| Styling | NativeWind v4 (Tailwind CSS) |
| Testing | Jest (unit) + Playwright (E2E) |
| Sync | WatermelonDB `synchronize()` with custom SyncService |

## Key Architecture

### Offline-First Data Flow
1. All writes go to local WatermelonDB first
2. `SyncService` pulls remote changes from Supabase and pushes local dirty records
3. UI reads from local WatermelonDB collections, not direct remote queries
4. Sync is throttled (60s cooldown) and respects online/offline state

### Schema
- WatermelonDB schema at `src/database/schema.ts` (version 35)
- 25+ tables including: borrowers, loans, payments, payment_schedules, expenses, remittances, collectors, employees, payrolls, loan_applications, guarantors, areas, action_logs, app_settings, loan_products, feature_flags
- All IDs are UUID v4
- Soft-delete via `deleted_at` timestamp on most models

### Sync Architecture
- `src/services/SyncService.ts` — main sync engine
- Maps local table names to remote Supabase tables via `REMOTE_TABLE_MAP` (e.g., `borrowers` → `app_borrowers`)
- Handles clock offset calculation, pagination, retry logic, and error reporting
- Zustand `syncStore` provides sync state (online/offline, progress, logs, pending counts)

### Auth & RBAC
- `src/store/AuthContext.tsx` — runtime auth gate with role resolution
- Role-based route guards prevent cross-role access
- Public routes: `loan-calculator`, `loan-application`
- Logout preserves local WatermelonDB data (destructive resets are explicit maintenance actions only)

## Project Structure

```
D:\GitHub\POS Cursor\
├── app/                    # Expo Router screens (file-based routing)
│   ├── _layout.tsx         # Root layout: AuthProvider + navigation
│   ├── login.tsx
│   ├── register.tsx
│   ├── (admin)/            # Admin role screens
│   ├── (borrower)/         # Borrower role screens
│   ├── (collector)/        # Collector role screens
│   ├── (loan-encoder)/     # Loan encoder screens
│   ├── (payment-encoder)/  # Payment encoder screens
│   ├── (expenses-encoder)/ # Expenses encoder screens
│   └── __tests__/          # Screen integration tests
├── src/
│   ├── components/         # Reusable UI components (NativeWind)
│   ├── constants/          # Shared constants, role metadata
│   ├── database/           # WatermelonDB setup, schema, models, migrations
│   │   ├── schema.ts       # App schema definition
│   │   ├── index.ts        # DB initialization (SQLite/LokiJS adapters)
│   │   └── supabase.ts     # Supabase client singleton
│   ├── hooks/              # Custom React hooks (network monitoring, etc.)
│   ├── services/           # Business logic services
│   │   ├── SyncService.ts  # Sync engine
│   │   ├── AuthService.ts  # Auth + role resolution
│   │   ├── CashService.ts  # Cash management
│   │   ├── MfiKpiService.ts # KPI calculations
│   │   └── ErrorService.ts # Error handling + user messages
│   ├── store/              # React Context stores
│   │   └── AuthContext.tsx # Auth state + RBAC
│   ├── stores/             # Zustand stores
│   │   ├── syncStore.ts    # Sync telemetry
│   │   └── authStore.ts    # Legacy/secondary auth store
│   └── utils/              # Helper functions, formatters, auth navigation
├── scripts/                # Utility scripts (114+ files)
│   ├── import/             # Data import scripts
│   ├── maintenance/        # DB repair, balance fixes
│   ├── verification/       # Audit and verification scripts
│   └── deploy-*.mjs        # Deployment scripts
├── supabase/               # Supabase config, migrations, seed data
├── tests/                  # Playwright E2E tests
├── docs/                   # Project documentation
│   ├── ARCHITECTURE.md
│   ├── DEVELOPER_GUIDE.md
│   ├── DEPLOYMENT.md
│   └── DATA_MANAGEMENT.md
└── .agents/                # Agent skills + workflows
```

## Commands

### Development
```bash
npm install                    # Install dependencies
npm run prepare:app            # Generate updates + check auth schema
npm run start                  # Expo dev server
npm run start:local            # Expo dev server with --clear (local env)
npm run android                # Build and run on Android
npm run ios                    # Build and run on iOS
npm run web                    # Expo web preview
npm run web:local              # Expo web with --clear (local env)
npm run export:web             # Production web export
```

### Testing
```bash
npm test                       # Run Jest unit tests
npx playwright test            # Run Playwright E2E tests
npx jest src/services/__tests__/SyncService.test.ts  # Run specific test
npx jest --watch               # Watch mode
```

### Local Supabase
```bash
npx supabase start             # Start local Supabase stack
```
Default local ports: API `45421`, DB `45422`, Studio `45423`

### Deployment
```bash
npm run deploy:cloudflare      # Deploy web to Cloudflare
npm run export:web:production  # Production web export
```

## Development Conventions

### Code Style
- `camelCase` for files (services, utils); `PascalCase` for components and models
- TypeScript `strict: false` (intentional, for WatermelonDB decorator compatibility)
- NativeWind `className` for styling — avoid inline styles
- Services: classes with static methods
- Tests co-located in `__tests__/` within each module

### WatermelonDB Patterns
- Use decorators: `@field`, `@date`, `@relation` (legacy mode)
- Never disable the decorator pipeline — required for WatermelonDB
- Use `prepareCreate`/`prepareUpdate` for mutations — never direct mutations
- Custom Babel pipeline: `babel-plugin-transform-typescript-metadata` + `@babel/plugin-proposal-decorators`
- `NODE_ENV=test` disables NativeWind JSX transform for test environment

### Supabase & Testing
- **Never** target production Supabase from tests (safety check in `playwright.config.ts`)
- Tests use `.env.test` with local Supabase defaults
- Playwright E2E runs on web platform only (Chromium)
- Jest uses LokiJS adapter (not SQLite) for tests

### Anti-Patterns to Avoid
- Direct mutations on WatermelonDB records (use `prepareCreate`/`prepareUpdate`)
- Inline styles when `className` works
- Disabling the decorator pipeline in Babel
- Connecting tests to production Supabase URLs (`YOUR_SUPABASE_PROJECT.supabase.co`, `YOUR_SUPABASE_PROJECT.supabase.co`)
- Clearing local WatermelonDB data on logout (only explicit maintenance scripts should do this)

## Git Hooks
- Husky configured for pre-commit and pre-push hooks
- Run `npm run prepare:app` as part of start hooks to keep generated files in sync

## Environment Variables

Use `.env.local` for local development. Production credentials belong in `.env.production`.

```env
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:45421
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_local_or_remote_anon_key
EXPO_PUBLIC_SUPABASE_DB_PASSWORD=postgres
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key
```

Env precedence: `.env.local` > `.env.<NODE_ENV>.local` > `.env.<NODE_ENV>` > `.env`

## Important Files

| File | Purpose |
|------|---------|
| `src/database/schema.ts` | WatermelonDB schema definition (source of truth for DB structure) |
| `src/services/SyncService.ts` | Offline-first sync engine (pull/push logic, table mapping) |
| `src/store/AuthContext.tsx` | Auth state, role resolution, RBAC guards |
| `src/stores/syncStore.ts` | Sync telemetry Zustand store |
| `src/database/index.ts` | WatermelonDB initialization (SQLite/LokiJS adapter selection) |
| `app/_layout.tsx` | Root layout, mounts AuthProvider + network monitoring |
| `babel.config.js` | Babel config with decorator pipeline for WatermelonDB |
| `playwright.config.ts` | E2E test config with production URL safety guard |
