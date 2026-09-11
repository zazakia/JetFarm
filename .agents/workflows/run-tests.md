---
description: How to run Jest tests with coverage for POSCursor services
---

# Run Tests Workflow

## Pre-Checks
1. Verify `.env.test` exists and does NOT point to production (`YOUR_SUPABASE_PROJECT`)
2. Ensure `node_modules` is installed (`npm install` if needed)

## Run a Single Service Test with Coverage
// turbo
3. Run: `npx jest src/services/__tests__/<TestFile>.test.ts --coverage --collectCoverageFrom="src/services/<ServiceFile>.ts"`

Example:
```bash
npx jest src/services/__tests__/CashService.test.ts --coverage --collectCoverageFrom="src/services/CashService.ts"
```

## Run All Service Tests
// turbo
4. Run: `npx jest src/services/__tests__/ --coverage`

## Run Full Test Suite
// turbo
5. Run: `npx jest --coverage`

## Review Coverage
6. Open `coverage/lcov-report/index.html` in browser to review line-by-line coverage

## Fix Failures
7. If tests fail:
   - Check mock setup in `src/jest-setup.ts`
   - Verify DI pattern: `new ServiceName(testDatabase)`
   - Check for hung LokiJS processes (kill and re-run if test runs >2 min)
