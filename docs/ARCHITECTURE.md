# POSCursor Architecture Documentation

This document describes the architecture implemented in the current codebase.

## 1. Core Architecture

### Offline-First Data Model
The app is built around WatermelonDB as the local source of truth.

1. Users write data locally first.
2. `SyncService` pulls remote changes from Supabase and pushes local dirty records back.
3. The UI reads primarily from local collections, not from direct remote queries.

This model is the backbone of the app and the reason field workflows continue to operate without connectivity.

### Role-Based App Shell
Expo Router route groups separate the main user roles:
- `(admin)`
- `(collector)`
- `(borrower)`
- `(loan-encoder)`
- `(payment-encoder)`
- `(expenses-encoder)`

`src/store/AuthContext.tsx` is the runtime auth/session gate. It resolves the session, derives the role, applies route guards, and redirects users into the correct group.

### Service Layer
Business logic is concentrated in `src/services/`.
Important services include:
- `AuthService`
- `SyncService`
- `CashService`
- `MfiKpiService`
- `KpiCalculator`
- `ReminderService`

Services are the strongest-tested part of the codebase.

## 2. Runtime Composition

### Root App Shell
`app/_layout.tsx` mounts:
- `AuthProvider`
- network monitoring via `useNetworkStatus()`
- `OfflineBanner`
- global toast/error surfaces

### Local Database
`src/database/index.ts` initializes WatermelonDB with:
- SQLite adapter on native
- LokiJS adapter on web and in tests

The schema currently covers 18 operational tables including borrowers, loans, payments, remittances, collectors, and audit/action logs.

### Sync State
`src/stores/syncStore.ts` holds:
- online/offline state
- sync status
- progress
- pending change counts
- sync logs

This Zustand store is used by the sync center, status badges, banners, and services.

## 3. Tech Stack
| Layer | Technology |
| --- | --- |
| Frontend framework | Expo SDK 55 |
| React Native | 0.83 |
| Routing | Expo Router |
| Local database | WatermelonDB (SQLite native, LokiJS web/test) |
| Backend | Supabase |
| Auth/session state | React Context |
| Sync/UI telemetry | Zustand |
| Forms | React Hook Form + Zod |
| Testing | Jest + Playwright |

## 4. Current Architectural Notes

### Auth State
The runtime auth path is `src/store/AuthContext.tsx`.

There is also a lightweight Zustand auth store in `src/stores/authStore.ts`, but it is not the primary runtime auth mechanism. Treat it as secondary or legacy until consolidated.

### Screen Thickness
Several route screens, especially dashboards, contain substantial query and aggregation logic. The app works, but some UI files are carrying orchestration that could be moved into dedicated selectors or services over time.

### Sync Behavior
`SyncService` is responsible for the offline-first contract. It uses WatermelonDB synchronization plus Supabase upserts and soft deletes. Sync observability is good, but reconnect behavior and route-level orchestration should be treated as active maintenance areas.

## 5. Logout and Persistence
Normal logout should preserve local WatermelonDB data and only end the Supabase session. Destructive local resets are explicit maintenance actions and should never be treated as standard logout behavior.

## 6. Testing Strategy
- Jest covers most core services and selected UI components.
- Playwright covers higher-level auth, role, and workflow scenarios in `tests/`.
- `src/jest-setup.ts` contains safety guards to prevent tests from using the production Supabase project.

## 7. Documentation Drift Warning
Older documents may still reference Expo SDK 51 or simpler Zustand-only state descriptions. The source of truth is the codebase:
- auth/session: `src/store/AuthContext.tsx`
- sync state: `src/stores/syncStore.ts`
- local DB bootstrap: `src/database/index.ts`
- sync engine: `src/services/SyncService.ts`
