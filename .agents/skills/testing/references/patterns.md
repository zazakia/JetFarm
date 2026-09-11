# Testing patterns reference

Companion to `../SKILL.md`. Prefer the skill for day-to-day work; use this for copy-paste blueprints.

## createTestDatabase

`src/__tests__/test-utils.ts` builds an in-memory LokiJS WatermelonDB with the full `modelClasses` list aligned to `mySchema`. Use it whenever tests need real local persistence without SQLite.

```typescript
import { createTestDatabase } from '../../__tests__/test-utils';

const database = createTestDatabase();
```

After writes, assert via `database.get('<table>').query().fetch()` or model helpers.

## Static service + global database (canonical)

Live example: `src/services/__tests__/MonthlyClosingService.test.ts`.

Checklist:

1. `jest.mock('../../database', …)` **before** importing the service under test if the mock must apply (or import service after mock as the file does).
2. Seed KPI/remote deps with `jest.fn()` mocks.
3. Clean affected tables in `beforeEach` with `destroyPermanently()` inside `database.write`.
4. Assert field-level snapshot / domain invariants, not just “truthy”.

## Screen test blueprint

Live example: `app/(cashier)/__tests__/returns.test.tsx`.

Checklist:

1. Mock `expo-router` (`useRouter` / `useLocalSearchParams` as needed).
2. Mock `useAuth` with the role/branch under test.
3. Stub heavy modals/icons.
4. Drive UI with `fireEvent` / `waitFor`; assert visible copy and service calls.
5. Keep business rules in service tests; screen tests prove wiring and enablement.

## Sync / integrity tests

- Unit: `src/services/__tests__/SyncService.test.ts`
- Integration-style: `SyncService.integration.test.ts`, `SyncService.regression.test.ts`, `SyncServicePushIntegrity.test.ts`
- Schema contract: `src/database/schemaContracts.regression.test.ts` (when present)
- Live production sync checks belong in scripts (`scripts/verify-sync-integrity.mjs`), **not** Jest.

## Playwright vs Jest

| Concern | Jest | Playwright (`tests/`) |
|---------|------|------------------------|
| Services, models, hooks | Yes | No |
| RNTL screen unit | Yes | Optional smoke |
| Multi-role browser flows | No | Yes |
| Production URL | Blocked | Config safety check |

Run E2E: `npm run test:e2e` or matrix `playwright_full`.

## Adding a new service test (checklist)

1. Create `src/services/__tests__/<Name>.test.ts`.
2. Choose injectable DB vs mocked global `database`.
3. Mock Supabase / peer services; never network.
4. Cover happy path, validation failure, and error return/throw contract.
5. Run `npx jest src/services/__tests__/<Name>.test.ts --no-coverage`.

## Refreshing baseline counts

After large test additions, update the “Current scale” table in `SKILL.md` from:

```powershell
npx jest --no-coverage
```

Do not hardcode coverage % unless measured in the same session.
