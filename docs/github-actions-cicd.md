# GitHub Actions CI/CD Pipeline & Scaling Guide

This guide details the GitHub Actions Continuous Integration and Continuous Deployment (CI/CD) architecture for POS Cursor / POSCursor and explains how to scale and reuse this setup across other projects.

---

## 1. Overview of Workflows

The repository contains two production workflow files in `.github/workflows/`:

| Workflow File | Purpose | Trigger Events |
|---|---|---|
| [`ci-cd.yml`](file:///e:/GitHub/POS Cursor/.github/workflows/ci-cd.yml) | Master CI/CD Pipeline for this project | `push` (main/master), `pull_request`, `workflow_dispatch` |
| [`reusable-ci-cd.yml`](file:///e:/GitHub/POS Cursor/.github/workflows/reusable-ci-cd.yml) | Reusable modular workflow for scaling across other projects | `workflow_call` |

---

## 2. Pipeline Stages

The CI/CD pipeline consists of 4 distinct jobs running in sequence/parallel:

```
┌──────────────────────────────┐   ┌──────────────────────────────┐   ┌──────────────────────────────┐
│  1. Static Analysis & Lint   │   │  2. Jest Unit & Integration  │   │  3. Playwright E2E Suite     │
│  - TypeScript (tsc)          │   │  - Service unit tests        │   │  - E2E flow tests            │
│  - Auth Schema pre-flight    │   │  - Code coverage artifact    │   │  - HTML report artifact      │
└──────────────┬───────────────┘   └──────────────┬───────────────┘   └──────────────┬───────────────┘
               │                                  │                                  │
               └──────────────────────────┬───────┴──────────────────────────────────┘
                                          ▼
                         ┌──────────────────────────────────┐
                         │  4. Build & Cloudflare Deploy    │
                         │  - Web production export         │
                         │  - SPA routing & asset post-fix  │
                         │  - Deploy to Cloudflare Pages    │
                         └──────────────────────────────────┘
```

---

## 3. Required GitHub Secrets & Variables

To enable automated deployments and test runs, configure the following secrets in GitHub (**Settings > Secrets and variables > Actions > New repository secret**):

| Secret Name | Description | Required For |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | API token with Cloudflare Pages Edit permissions | Deployment |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID | Deployment |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase API endpoint URL | Web Export / Tests |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anonymous Client Key | Web Export / Tests |
| `EXPO_PUBLIC_ENCRYPTION_KEY` | Database encryption key | Web Export / Tests |

> [!TIP]
> Standard fallback mock values are built into the test pipeline stage so pull request verification checks pass cleanly even before production secrets are configured.

---

## 4. How to Use the Reusable Workflow in Other Projects

To scale this CI/CD pipeline to another Expo, React Native, or Node project, create `.github/workflows/ci.yml` in your target repository with the following configuration:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  call-cicd-pipeline:
    uses: zazakia/POS Cursor/.github/workflows/reusable-ci-cd.yml@main
    with:
      node-version: '22'
      run-typecheck: true
      run-unit-tests: true
      run-e2e-tests: false
      deploy-target: 'cloudflare'
      cloudflare-project-name: 'my-other-project'
      build-command: 'npm run export:web:production'
    secrets:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.EXPO_PUBLIC_SUPABASE_URL }}
      EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY }}
```

---

## 5. Local Pre-Flight Verification

Before pushing code to trigger GitHub Actions, you can run the exact local pre-flight pipeline script:

```bash
# Run local pre-flight validation (typecheck + jest + e2e + web export)
npm run workflow:e2e

# Run local pre-flight with Cloudflare deploy dry-run
node scripts/pipeline-e2e.mjs --dry-run --deploy
```
