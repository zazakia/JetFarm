# [QA/Testing] Cloudflare Deployment & Migration Verification Pipeline

## Related Issue
Parent Issue: #56

## Scope
- Pre-flight database migration checks
- Production/Local synchronization scripts
- Automated Cloudflare Pages build and post-processing

## Target Scripts
- [deploy-pipeline.mjs](file:///e:/GitHub/POS Cursor/scripts/deploy-pipeline.mjs)
- [deploy-cloudflare.mjs](file:///e:/GitHub/POS Cursor/scripts/deploy-cloudflare.mjs)
- [check-production-migrations.mjs](file:///e:/GitHub/POS Cursor/scripts/check-production-migrations.mjs)
- [apply-all-local-migrations.mjs](file:///e:/GitHub/POS Cursor/scripts/apply-all-local-migrations.mjs)

## Test Cases & Checklist
- [ ] **Migration Check Utility**:
  - Run `node scripts/check-production-migrations.mjs` to verify zero pending schema collisions.
- [ ] **Local Database Sync & Seed**:
  - Run `node scripts/apply-all-local-migrations.mjs` and `node scripts/seed-test-users.mjs`.
  - Confirm clean execution without error exit codes.
- [ ] **Cloudflare Build & Deployment Verification**:
  - Execute pre-flight build check: `node scripts/deploy-pipeline.mjs`
  - Verify web export completes cleanly with NativeWind static CSS bundle intact.

## Verification Command
```bash
node scripts/check-production-migrations.mjs
```
