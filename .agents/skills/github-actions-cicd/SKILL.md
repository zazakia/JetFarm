---
name: github-actions-cicd
description: Guide and standard operating procedures for GitHub Actions CI/CD workflows, reusable workflow scaling, and Cloudflare Pages deployment in POS Cursor/POSCursor.
---

# GitHub Actions CI/CD Skill (Expo Router, NativeWind v4, WatermelonDB/Supabase)

This skill provides operational guidance for managing, verifying, and scaling automated testing and deployment workflows using GitHub Actions.

## Key Workflow Files

1. **Master Pipeline**: [`.github/workflows/ci-cd.yml`](file:///d:/GitHub/posCURSORv2/.github/workflows/ci-cd.yml)
   - Runs static typechecks (`tsc --noEmit`), Jest unit tests with coverage, Playwright E2E suite, and deploys production web exports to Cloudflare Pages on push to `main`/`master` or via manual dispatch.
2. **Reusable Workflow**: [`.github/workflows/reusable-ci-cd.yml`](file:///d:/GitHub/posCURSORv2/.github/workflows/reusable-ci-cd.yml)
   - Scalable workflow template callable by any other repository via `workflow_call`.
3. **Documentation**: [`docs/github-actions-cicd.md`](file:///d:/GitHub/posCURSORv2/docs/github-actions-cicd.md)
   - Full setup guide including secret configuration and project scaling instructions.

## Verification Commands

Run local pipeline validation before pushing changes:

```bash
# Static TypeScript Check
npx tsc --noEmit

# Jest Test Suite
npm test -- --coverage --ci --maxWorkers=2

# Full Pipeline Verification
npm run workflow:e2e
```
