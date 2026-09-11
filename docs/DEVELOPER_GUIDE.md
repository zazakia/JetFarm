# Developer Guide

This guide provides information on how to contribute to the POSCursor project, run tests, and use the utility scripts.

## 🛠 Working with Scripts

The `scripts/` directory contains various utility scripts for maintenance, data migration, and debugging.

### Data Migration
- **`import_excel.js`**: Imports data from Excel files in the `data/` directory into the system.
- **`migrate_excel.js`**: A more specific migration script for complex Excel structures.
- **`seed-collectors.mjs`**: Seeds collector accounts into Supabase.

### Database Maintenance
- **`adjust_balances.js`**: Fixes logic for loan balance calculations.
- **`fix_schedule_statuses.js`**: Updates payment schedule statuses based on actual payments.
- **`recompute-schedules.js`**: Recomputes all payment schedules for active loans.

### Verification & Auditing
- **`deep_verify.js`**: Performs a deep audit of the data between local DB and Supabase.
- **`verify_db_balances.js`**: Checks for mathematical parity in loan balances.
- **`check-schema.mjs`**: Verifies that the local WatermelonDB schema matches the expectations.

## 🧪 Testing

We use Jest for unit and integration testing.

### Running Tests
```bash
# Run all tests
npm test

# Run a specific test file
npx jest src/services/__tests__/SyncService.test.ts

# Run tests in watch mode
npx jest --watch
```

### Test Structure
- **Unit Tests**: Located in `src/**/__tests__`.
- **Integration Tests**: Located in `app/__tests__` and `src/services/__tests__`.

## 🔍 Debugging

### Artifacts and Logs
Check the `artifacts/` directory for:
- **`*.png`**: Screenshots from failed test runs or emulator captures.
- **`*.log` / `*.txt`**: Test execution logs and debug output.
- **`local.db`**: A copy of the SQLite database for inspection with tools like DB Browser for SQLite.

### Metro Bundler Issues
If you encounter Metro errors, check `artifacts/metro_error_output.json` for detailed traces.
