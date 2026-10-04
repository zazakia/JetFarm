---
description: Complete global end-to-end software development, testing, build, and deployment workflow for JetFarm
---

# End-to-End Software Development Pipeline

This document defines the global end-to-end software development lifecycle (SDLC) workflow for JetFarm.

## Workflow Overview

```mermaid
graph TD
    A[Feature Development] --> B[Static Analysis & Typecheck]
    B --> C[Jest Unit & Service Integration Suite]
    C --> D[Playwright E2E Verification Suite]
    D --> E[Web Production Export Build]
    E --> F[Cloudflare Pages Deployment]
    F --> G[Post-Deploy Smoke Verification]
```

---

## Stage 1: Local Development & Verification

Before submitting code changes, run the global end-to-end verification pipeline locally:

```bash
# Run full local verification (Typescript + Jest + Playwright + Web Build)
npm run workflow:e2e
```

To include a deployment step in the local run (`pipeline-e2e.mjs --deploy`):
```bash
npm run workflow:e2e -- --deploy
```
> ⚠ Deployment is human-triggered only. AI agents must not run `--deploy`, `deploy:hetzner`, or `deploy:cloudflare` autonomously (see `AGENTS.md` → AI Automation Policy).

---

## Stage 2: Automated CI/CD Pipeline

When code is pushed to `main` or a pull request is opened, GitHub Actions executes `.github/workflows/ci-cd.yml` (see also `jest.yml`, `playwright.yml`):

1. **Static Analysis & Type Check**:
   - Executes `npx tsc --noEmit`
   - Validates schema and imports
2. **Jest Unit & Integration Suite**:
   - Executes `npm test -- --coverage --ci --maxWorkers=2`
   - Uploads test coverage artifacts
3. **Playwright E2E Suite**:
   - Executes `npx playwright test`
   - Uploads Playwright HTML test reports
4. **Build & Deployment**:
   - `npm run export:web:production` builds the static bundle.
   - **Live deployment is Hetzner-only**: `npm run deploy:hetzner` publishes to `https://jetfarm.818.quest`. The Cloudflare path (`jetfarm.pages.dev`) is a dead placeholder with no credentials and must not be used as a deploy target. Deploys are **human-triggered only** per `AGENTS.md` → AI Automation Policy.

---

## Stage 3: Post-Deployment Smoke Check

Verify live production deployment:

1. **URL**: `https://jetfarm.818.quest`
2. **Key Checkpoints**:
   - Application loads without SPA routing errors (`_redirects` active)
   - Supabase sync initializes clean local WatermelonDB instance
   - Role authentication (Admin, Collector, Encoder, Borrower) works correctly
   - **Accounting Transaction Connection & Financial Statement Reconciliation**:
     - All outside-accounting transactions (Cash on Hand, Cash in Bank, Share Capital/CBU, Savings deposits & withdrawals, Expenses) auto-post double-entry journal entries into General Ledger (`journal_entries`).
     - Financial reports & statements (Balance Sheet, Income Statement, Statement of Cash Flows, Statement of Changes in Equity, Trial Balance) aggregate and reflect 100% of live production DB data accurately.
     - Admin Accounting Overview screen (`app/(admin)/accounting/index.tsx`) includes functional "Reconcile DB" action to trigger real-time auto-posting backfill.
     - UI/UX encoding screens and modals (Petty Cash, Expenses, Savings, Share Capital) properly record data and post to accounting.

