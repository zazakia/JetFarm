# POSCursor verification surfaces

## In default matrix (`scripts/run_matrix.mjs`)

### Baseline

- `npx tsc --noEmit`
- `npx expo-doctor`

### Jest module buckets

Discovered dynamically from `app/**/__tests__` and `src/**/__tests__` that contain `*.test.(ts|tsx|js|jsx)`.

Observed buckets (refresh via a matrix run’s `jest-buckets.json`):

- `app/__tests__`
- `app/(admin)/accounting/__tests__`
- `app/(admin)/borrowers/__tests__`
- `app/(admin)/cash-on-hand/__tests__`
- `app/(admin)/collectors/__tests__`
- `app/(admin)/reports/__tests__`
- `app/(admin)/settings/__tests__`
- `app/(admin)/users/__tests__`
- `app/(borrower)/__tests__`
- `app/(cashier)/__tests__`
- `src/components/__tests__`
- `src/config/__tests__`
- `src/constants/__tests__`
- `src/database/__tests__`
- `src/database/models/__tests__`
- `src/hooks/__tests__`
- `src/modules/__tests__`
- `src/services/__tests__`
- `src/services/cic/__tests__`
- `src/store/__tests__`
- `src/stores/__tests__`
- `src/utils/__tests__`

Note: files matching `**/?(*.)+(test).[tj]s?(x)` outside those folders still run in **jest_full** (e.g. `*.regression.test.ts` under `src/database/`).

### Integrated

- `npm test -- --runInBand --forceExit`
- `npx playwright test --workers=1 --reporter=list` (unless `--skip-playwright`)
- `npm run export:web` (unless only-filtered out)

### Export smoke

After `dist/` exists:

1. Serve `dist/` on a free localhost port (prefers 19009).
2. Open root URL in Chromium (`@playwright/test` chromium).
3. Fail on page errors or console errors.
4. Persist `smoke.json` with final URL, title, errors.

## Outside the default script (manual / deploy skill)

Use when releasing, not every matrix run:

| Gate | Command / note |
|------|----------------|
| ESLint | `npm run lint` |
| Production web export | `npm run export:web:production` |
| Sync schema contract | `npx jest src/database/schemaContracts.regression.test.ts` (if present) |
| Live sync integrity (read-only) | `node scripts/verify-sync-integrity.mjs --production` |
| Visual E2E helper | `node scripts/verify-visual-e2e.mjs` (when present) |
| Staging server test | `npm run test:staging` |

See `../deploy-poscursor/SKILL.md` for the full ship checklist.

## Evidence expectations

Always use the newest timestamped directory under:

```text
tmp/systematic-test-matrix/
```

For failures report:

- step name
- exit code
- log file path
- first actionable error or failing test name

## Extending the matrix

1. Prefer discovering new `__tests__` dirs automatically (no script change).
2. To add a new top-level step, edit `scripts/run_matrix.mjs` `plannedSteps` and document it here.
3. Keep Playwright and smoke skippable for local debug loops.
