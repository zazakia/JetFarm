# POSCURSOR - COOP: Release & Change Documentation

**Document Created:** 2026-08-05  
**Version Range:** v1.6.0 (2026-06-29) → v2.5.0 (2026-08-05)  
**Target App:** POSCURSOR Mobile & Web Application (Expo React Native + WatermelonDB + Supabase)  
**Environment:** Staging & Production (Cloudflare Pages `jetfarm.pages.dev` / Supabase `YOUR_SUPABASE_PROJECT`)

---

## Executive Summary

This document provides a comprehensive, chronological record of all changes, features, bug fixes, and infrastructure enhancements made to the **POSCURSOR** microfinance and cooperative management system from **newest to oldest** prior to pushing the upcoming client release.

---

## 1. Version 2.5.0 (2026-08-05)
### Accounting Auto-Posting, Fund Transfer Service, UI Accessibility & Data Reconciliation

#### 🚀 Features & Enhancements
- **Fund Transfer Service (`src/services/FundTransferService.ts`)**:
  - Implemented dedicated fund transfer flow between bank accounts and cash box vault (`app/(admin)/transfers/index.tsx`).
  - Added support for bank withdrawal, deposit, and inter-account ledger transfers with automated audit logging.
- **Enhanced Auto-Posting (`src/services/AutoPostingService.ts`)**:
  - Automated dual-entry journal posting for loan disbursements, payment collections, expenses, and member savings deposits/withdrawals.
  - Linked journal entry lines directly to Chart of Accounts (`chart_of_accounts`) with automatic balance verification.
- **Chart of Accounts ID Normalization (`supabase/migrations/20260805074322_normalize_legacy_account_codes.sql`)**:
  - Applied deterministic UUID v5 mapping for legacy account codes to resolve migration collisions and enforce FK integrity.
- **UI Accessibility & WCAG Compliance (`scripts/audit-ui-contrast.js`)**:
  - Conducted UI contrast audit across light and dark modes. Updated text tokens, stat cards (`StatCard.tsx`), metric breakdowns (`MetricBreakdownDialog.tsx`), and search bars (`SearchBar.tsx`).
  - Added application form print preview screen (`app/(admin)/loans/[id]/application-form.tsx`).

#### 🛠️ Data Ops & Production Verification
- **ONDL Loan Reconciliation (`scripts/sync-ondl-loans-to-supabase.mjs`, `scripts/reconcile-ondl-final.mjs`)**:
  - Audited legacy Excel schedules (`onDLLoaner2026.xlsx`) against production loans. Resolved duplicate loan numbers and discrepancy cases (e.g. Abrenillo & Gonzales accounts).
- **Production Integrity Suite (`scripts/verify-production-db-integrity.mjs`)**:
  - Created automated database integrity checker for borrower IDs, loan schedules, GL balances, and image attachments.
  - Performed live browser verification of accounting module (`scripts/verify-live-accounting-browser.mjs`).

---

## 2. Version 2.4.0 (2026-08-01)
### Member Financial Services & Borrower Detail View Refactoring

#### 🚀 Features & Enhancements
- **Borrower Savings & CBU Modules**:
  - Redesigned borrower details screens (`app/(admin)/borrowers/[id]/savings.tsx`, `savings-transactions.tsx`, `share-capital.tsx`).
  - Added real-time transaction history breakdowns for share capital deposits, interest credits, and savings withdrawals.
- **Financial Services Update**:
  - Updated `LoanService`, `PaymentService`, and `ShareCapitalService` for faster querying and cached account balances.

---

## 3. Version 2.3.0 (2026-07-31)
### Collector Commission Engine & Expense Refactoring

#### 🚀 Features & Enhancements
- **Collector Commission Service (`src/services/CollectorCommissionService.ts`)**:
  - Integrated dynamic commission rate calculations based on active collections, member coverage, and performance tiers.
  - Added commission rate settings in collector profile management (`app/(admin)/collectors/index.tsx`).
- **Expenses & Category Enhancements**:
  - Enabled editing of expense entries (`app/(admin)/expenses/index.tsx`) and prevented deletion of essential categories (e.g. 'Petty Cash (COH)').

---

## 4. Version 2.2.0 (2026-07-30)
### Share Capital Reports, Dividend Engine & Migration Safety

#### 🚀 Features & Enhancements
- **Share Capital & CBU Reporting (`app/(admin)/reports/share-capital.tsx`, `cbu.tsx`)**:
  - Built comprehensive member equity reporting views showing individual share balances, dividend earnings, and average monthly share capital holdings.
- **Dividend Service Enhancements (`src/services/DividendService.ts`)**:
  - Updated statutory dividend distribution logic per CDA rules (Patronage Dividend + Share Capital Dividend).

#### 🐛 Bug Fixes & Infrastructure
- **AGAP Migration Policy Guard (`scripts/check-production-migrations.mjs`)**:
  - Resolved policy collisions on remote Supabase migrations and enforced local execution order verification (`scripts/apply-all-local-migrations.mjs`).

---

## 5. Version 2.1.0 (2026-07-29)
### Cloudflare Pages Deployment Pipeline & POSCURSOR Rebrand

#### 🚀 Features & Enhancements
- **Rebrand to POSCURSOR - COOP (`71c8052`)**:
  - Updated app branding parameters in `app.json`, brand constants (`src/constants/brand.ts`), logo assets (`poscursor_mark.png`), and login screen styling.
- **Cash on Hand & Misc Income Flow**:
  - Enhanced Cash on Hand screen (`app/(admin)/cash-on-hand/new.tsx`) to support bank transfers, cash withdrawals, and miscellaneous income entries.
- **Cloudflare Deployment Pipeline (`.agents/skills/cloudflare-deploy/SKILL.md`)**:
  - Automated web bundle export (`scripts/export-web-production.mjs`), asset post-processing, and deployment to `jetfarm.pages.dev`.

---

## 6. Version 2.0.0 (2026-07-28)
### MPCO Framework, Marketplace & Multi-Module Architecture

#### 🚀 Features & Enhancements
- **Multi-Purpose Cooperative Framework (MPCO)**:
  - Added modular support for cooperative business units (Agri-store, Pharmacy, Transport, Marketplace).
- **Marketplace Engine**:
  - Created database models: `MarketplaceStore`, `MarketplaceProduct`, `MarketplaceOrder`, `MarketplaceSubOrder`, `MarketplaceOrderItem`, `MarketplacePayout`, `MarketplaceReview`, `MarketplaceDispute`.
  - Built `MarketplaceOrderService`, `MarketplaceProductService`, `MarketplaceStoreService`, and `MarketplacePayoutService`.
  - Added Admin Marketplace overview (`app/(admin)/marketplace`) and Borrower Seller Center (`app/(borrower)/seller-center`).

---

## 7. Version 1.9.0 (2026-07-23 – 2026-07-27)
### Savings & CBU Account Migration & In-App Updates Engine

#### 🚀 Features & Enhancements
- **Account Migration (`scripts/migrate-savings-cbu.mjs`)**:
  - Migrated legacy savings and CBU data from member profile records to separate `app_savings_transactions` and account ledgers.
- **In-App Release History (`src/constants/generatedAppUpdates.ts`)**:
  - Generated automated update feed exposed directly in the mobile app UI so users can track shipped features and bug fixes.
- **Staging Transaction Utilities (`scripts/clear-transactions.mjs`)**:
  - Built safe transaction resetting tools for testing environments without wiping member profiles.

---

## 8. Version 1.8.0 (2026-07-14)
### Cash Box Vault Balance Integration & Dynamic Loan Computation

#### 🚀 Features & Enhancements
- **Cash Box Vault Connection (`74da722`)**:
  - Unified Cash Box Vault balance with loan disbursements, payment collections, savings deposits, and share capital contributions.
- **Bank Ledger & Cash Transfer (`9e1a111`)**:
  - Added support for Fund Transfer in bank ledger and renamed Cash In/Out to Cash Transfer.
- **Dynamic Loan Deductions Fix (`8cdc79f`)**:
  - Excluded `dstFee` and `udiRebatableFee` from upfront deductions in `LoanCalculatorService`.
  - Updated loan application slips and breakdown views for backward compatibility.
- **Member Manual & Auto-Sync (`a596093`, `c401652`)**:
  - Integrated Operation Manual into borrower navigation (#29).
  - Enabled auto-sync and pull-to-refresh manual sync in Borrower Dashboard (#37).

---

## 9. Version 1.7.0 (2026-07-05 – 2026-07-13)
### Dynamic Allocation Settings & CDA Financial Statement Module

#### 🚀 Features & Enhancements
- **Dynamic Cooperative Calculation Settings (`7179f41`, `e8b862a`)**:
  - Replaced hardcoded interest rates and fund allocations with dynamic database-backed configuration via `SettingsService`.
  - Created Cooperative Computations admin settings screen with 100% allocation sum validation.
- **CDA-Format Financial Reports (`a7e2619`, `c2136e3`)**:
  - Implemented Balance Sheet, Income Statement, Statement of Changes in Equity, and Trial Balance compliant with Cooperative Development Authority standards.
  - Fixed retained surplus double-counting issue in Balance Sheet formulas.
- **Offline Historical Data Migration (`14e6bb8`, `f9ab696`)**:
  - Seeded audited historical financial data for FY2024 and FY2025.

---

## 10. Version 1.6.0 (2026-06-29 – 2026-07-02)
### Dividend Distribution Engine & Sync Service Infrastructure

#### 🚀 Features & Enhancements
- **Dividend Distribution Service (`1a4e557`)**:
  - Built patronage dividend calculation engine with administrative preview and distribution execution.
- **WatermelonDB ↔ Supabase Sync Engine (`SyncService.ts`)**:
  - Established offline-first bidirectional synchronization engine with schema validation, pull/push change batching, soft-delete handling (`deleted_at`), and custom table mapping (`REMOTE_TABLE_MAP`).

---

## Verification & Pre-Deployment Checklist

Before deploying the client update, ensure the following steps are verified:

1. **TypeScript Type Safety**:
   ```bash
   npx tsc --noEmit
   ```
2. **Unit & Integration Test Suite**:
   ```bash
   npm test
   ```
3. **Database Integrity & Schema Sync Check**:
   ```bash
   node scripts/verify-production-db-integrity.mjs
   ```
4. **Cloudflare Web Export Validation**:
   ```bash
   node scripts/export-web-production.mjs
   ```
