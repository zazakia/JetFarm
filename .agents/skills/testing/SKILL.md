---
name: testing
description: >-
  Write, extend, and run Jest unit/integration tests for POSCursor (Expo RN +
  WatermelonDB LokiJS). Use when adding services/screens/hooks, fixing failing
  Jest tests, following TDD, or choosing mocks/createTestDatabase patterns.
  Do not use for Playwright E2E or the full release matrix — use
  systematic-test-matrix instead.
---

# Testing Skill — POSCursor

## When to use

| Need | Skill |
|------|--------|
| Author/fix Jest unit or service tests | **This skill** (`testing`) |
| Full QA ladder (tsc → Jest buckets → Playwright → export smoke) | `systematic-test-matrix` |
| Deploy after green QA | `deploy-poscursor` |
| Sync engine debugging | `sync-debug` |

## Current scale (baseline)

As of 2026-09-11 (local `npx jest --no-coverage`):

| Metric | Value |
|--------|--------|
| Suites | ~193 |
| Tests | ~1554 |
| Typical wall time | ~50–60s (`maxWorkers: 2`) |
| Playwright | Separate; under `tests/` (ignored by Jest) |

Prefer **targeted** Jest while iterating. Use the matrix only for release confidence.

## Stack

| Layer | Tech |
|-------|------|
| Runner | `jest-expo` (`jest.config.js`) |
| Setup | `src/jest-setup.ts` |
| Assertions | `@testing-library/jest-native/extend-expect` |
| Test DB | LokiJS via `createTestDatabase()` in `src/__tests__/test-utils.ts` |
| Timeout | 15s (`testTimeout`) |
| Workers | `maxWorkers: 2` |
| Coverage | `src/**/*.{js,jsx,ts,tsx}` excl. `.d.ts`, `mocks/`, `assets/`, `generatedAppUpdates.ts` |

## Safety guard (non-negotiable)

`src/jest-setup.ts` blocks production Supabase via `isProductionSupabaseUrl()`. If `EXPO_PUBLIC_SUPABASE_URL` points at production, tests **throw immediately**.

Use `.env.test` or rely on fallbacks set in setup:

```text
EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=dummy-key
```

Never point Jest at `tigydhnptczbhvqwhiyh` (production). Playwright has its own safety check in `playwright.config.ts`.

## TDD workflow

1. **RED** — Add a failing test next to the code (`__tests__/Name.test.ts(x)`).
2. **GREEN** — Implement the minimum to pass.
3. **REFACTOR** — Keep tests green; no production code without a failing test first when adding behavior.

Co-locate tests:

- Services → `src/services/__tests__/` (or `src/services/<area>/__tests__/`)
- Models → `src/database/models/__tests__/`
- Hooks → `src/hooks/__tests__/`
- Components → `src/components/__tests__/`
- Screens → `app/(role)/…/__tests__/`

## Patterns

### 1) Injectable service + test DB

Prefer constructor/`Database` injection when the service supports it:

```typescript
import { createTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';
import { ActionLogService } from '../ActionLogService';

let database: Database;
let service: ActionLogService;

beforeEach(() => {
  database = createTestDatabase();
  service = new ActionLogService(database);
  jest.clearAllMocks();
});
```

### 2) Static service using global `database`

When the class imports `database` from `src/database`, mock the module and inject LokiJS (see `MonthlyClosingService.test.ts`):

```typescript
jest.mock('../../database', () => {
  const { createTestDatabase } = jest.requireActual('../../__tests__/test-utils');
  return { database: createTestDatabase() };
});

import { database } from '../../database';

beforeEach(async () => {
  await database.write(async () => {
    const rows = await database.get('financial_snapshots').query().fetch();
    for (const row of rows) await row.destroyPermanently();
  });
  jest.clearAllMocks();
});
```

Avoid `unsafeResetDatabase()` on LokiJS — it can hang/destroy the adapter. Delete rows manually instead.

### 3) Screen / component tests (RNTL)

Use `@testing-library/react-native`. Mock navigation, auth, and heavy children:

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('../../../src/store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'cashier@poscursor.com' },
    branchId: 'branch-1',
  }),
}));
```

Reference: `app/(cashier)/__tests__/returns.test.tsx`.

### 4) Supabase / remote I/O

Auto-mock `src/database/supabase` via `src/database/__mocks__/supabase.ts` (chainable `.from().select()…`). Do not hit live networks in unit tests.

## Mock catalog

### Auto-mocks (`__mocks__/`)

- `src/database/__mocks__/index.ts` — global `database`
- `src/database/__mocks__/supabase.ts` — Supabase client stub

### Setup mocks (`src/jest-setup.ts`)

- `react-native-gesture-handler`, `expo-blur`, `react-native-safe-area-context`
- `@expo/vector-icons`, `@react-native-async-storage/async-storage`
- `react-native-reanimated`, `react-native-worklets` / `worklets-core`
- `nativewind` (`cssInterop`, `styled`, …)

### Common per-file mocks

```typescript
jest.mock('../AuthService', () => ({
  AuthService: { getCurrentUserId: jest.fn().mockResolvedValue('user-123') },
}));

jest.mock('../../components/AppToast', () => ({ show: jest.fn() }));
```

## Commands

```powershell
# Fast full suite (preferred day-to-day)
npx jest --no-coverage

# One file
npx jest src/services/__tests__/CashService.test.ts --no-coverage

# One file with focused coverage
npx jest src/services/__tests__/CashService.test.ts --coverage --collectCoverageFrom="src/services/CashService.ts"

# Bucket
npx jest src/services/__tests__/ --no-coverage
npx jest "app/(cashier)/__tests__/" --no-coverage

# npm script (same runner; may include coverage depending on invocation)
npm test -- --no-coverage
```

Windows tip: quote paths with parentheses, e.g. `"app/(admin)/reports/__tests__/"`.

## Jest buckets (discovered)

Directories with real `*.test.*` files (matrix script discovers these dynamically):

| Bucket | Approx. files |
|--------|----------------|
| `src/services/__tests__` | ~89 |
| `src/utils/__tests__` | ~21 |
| `src/components/__tests__` | ~15 |
| `app/(admin)/settings/__tests__` | ~7 |
| `app/(admin)/reports/__tests__` | ~7 |
| `src/hooks/__tests__` | ~6 |
| `app/(cashier)/__tests__` | ~5 |
| `src/services/cic/__tests__` | ~5 |
| `app/(admin)/accounting/__tests__` | ~5 |
| + models, store(s), config, constants, modules, other `app/(*)` | … |

Also: regression files outside `__tests__` folders (e.g. `src/database/supabaseMigrations.regression.test.ts`) still match Jest `testMatch` and run in the full suite.

## Coverage gaps (priority backlog)

High-value services still thin/untested (exclude configs/fixtures):

- `BusinessUnitService.ts`
- `DividendService.ts`
- `MarketplaceOrderService.ts` / `MarketplacePayoutService.ts` / `MarketplaceProductService.ts` / `MarketplaceSalesPostingService.ts` / `MarketplaceStoreService.ts`
- `cic/CicFormatterService.ts`

When asked to “improve test coverage,” start here with TDD, not blanket snapshot churn.

## Babel / Jest gotchas

- `babel.config.js` disables NativeWind transform when `NODE_ENV=test`.
- Decorators: `@babel/plugin-proposal-decorators` (legacy) + `babel-plugin-transform-typescript-metadata` — do not remove for WatermelonDB.
- `testPathIgnorePatterns` excludes `<rootDir>/tests/` (Playwright) and `src/__tests__/test-utils.ts`.
- Hung LokiJS / multi-minute single suite → kill worker and re-run that file alone; prefer row deletes over `unsafeResetDatabase()`.

## Definition of done (Jest change)

1. New/changed behavior has a failing-then-passing test.
2. Targeted file passes: `npx jest <path> --no-coverage`.
3. Related bucket or full suite is green before claiming done on broad changes.
4. No production URL / live Supabase in unit tests.

## Related docs

- Deeper inventory & examples: `references/patterns.md`
- Full verification ladder: `../systematic-test-matrix/SKILL.md`
