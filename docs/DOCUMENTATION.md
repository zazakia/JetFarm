# POSCursor Technical Documentation

## Overview
POSCursor is an offline-first microfinance app built with Expo, React Native, WatermelonDB, and Supabase. The app prioritizes local reliability first and remote synchronization second.

## Main Runtime Pieces

### App Shell
- `app/_layout.tsx` mounts the global app shell.
- `src/store/AuthContext.tsx` is the runtime auth/session source of truth.
- `src/hooks/useNetworkStatus.ts` keeps online state in sync and can trigger reconnection syncs.

### Local Persistence
- `src/database/index.ts` initializes WatermelonDB.
- Native platforms use SQLite.
- Web and tests use LokiJS.
- `src/database/schema.ts` defines the local tables and schema version.

### Remote Integration
- `src/database/supabase.ts` configures the Supabase client.
- `src/services/SyncService.ts` bridges local WatermelonDB tables with Supabase tables.
- Sync status, logs, and pending counts are stored in `src/stores/syncStore.ts`.

## State Management
The codebase uses two different state patterns for different concerns.

### React Context
Used for auth/session state in `src/store/AuthContext.tsx`.
Responsibilities:
- session initialization
- role lookup
- collector ID resolution
- route protection and redirects
- logout flow

### Zustand
Used mainly for sync/UI telemetry.
Primary store:
- `src/stores/syncStore.ts`

There is also `src/stores/authStore.ts`, but it is not the primary runtime auth path.

## Authentication and Logout
- Sign-in is handled by `AuthService.signIn()` through Supabase Auth.
- Role resolution prefers local data, then remote Supabase lookups, then controlled fallbacks.
- Normal logout ends the Supabase session and preserves local WatermelonDB data.
- Manual database reset is a separate maintenance action.

## Synchronization Model
`SyncService` synchronizes 18 local tables with Supabase.

### Pull phase
- fetches active records by `updated_at`
- fetches soft-deleted records by `deleted_at`
- converts remote timestamps into local numeric values
- merges changes into WatermelonDB

### Push phase
- collects local created and updated records
- strips WatermelonDB metadata fields
- converts local numeric timestamps back to ISO strings
- upserts into Supabase
- represents deletes as `deleted_at` soft deletes

## Environment Strategy
Preferred env files:
- `.env.local` for local development
- `.env.production` for deployment
- `.env.test` for Jest and CI safety

Common local variables:
```env
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:45421
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_SUPABASE_DB_PASSWORD=postgres
SUPABASE_SERVICE_ROLE_KEY=...
```

Local Supabase defaults in this repo:
- API: `http://127.0.0.1:45421`
- DB: `127.0.0.1:45422`
- Studio: `http://127.0.0.1:45423`

## Testing
### Jest
- Configured in `jest.config.js`
- Native and Expo modules are heavily mocked in `src/jest-setup.ts`
- Production Supabase URL usage is blocked in tests

### Playwright
- End-to-end coverage lives in `tests/`
- Focuses on auth, roles, sync, and primary flows

## Practical Notes
- The service layer is the cleanest and most tested part of the codebase.
- Some route screens are still carrying heavy query and KPI aggregation logic.
- Documentation should be kept aligned with the code, especially around auth flow, env handling, and logout semantics.
