# [QA/Testing] Test Matrix & Verification for Recent Features and System Changes (August 2026)

## Overview
This master issue tracks QA verification and testing procedures for all recent features, UI updates, service enhancements, and database migration utilities added in the latest release cycle.

### Sub-Issues Directory
- 🔗 **[#57 - Collector Commission & Auto-Posting System Verification](https://github.com/zazakia/POS Cursor/issues/57)**
- 🔗 **[#58 - Borrower Financial Services (Savings, CBU & Share Capital) Verification](https://github.com/zazakia/POS Cursor/issues/58)**
- 🔗 **[#59 - Expenses Module & Encoder UI Verification](https://github.com/zazakia/POS Cursor/issues/59)**
- 🔗 **[#60 - Cloudflare Deployment & Migration Verification Pipeline](https://github.com/zazakia/POS Cursor/issues/60)**
- 🔗 **[#61 - Financial Module Requirements, Fund Transfers & Expense Bug Fixes](https://github.com/zazakia/POS Cursor/issues/61)**

---

## 1. Collector Commission & Auto-Posting System (#57)
**Scope / Components**: `CollectorCommissionService`, `AutoPostingService`, `PaymentService`, `MemberFinancialSummaryService`
**UI Routes**:
- `app/(admin)/users/[id].tsx` & `app/(admin)/users/new.tsx`
- `app/(admin)/borrowers/index.tsx`
- `app/(borrower)/savings-cbu.tsx`
- `app/(admin)/expenses/new.tsx`

### QA Verification Checklist
- [ ] **Collector Commission Calculation**:
  - Test calculation logic for collector commissions when payments are recorded.
  - Verify that commissions properly reflect configured percentage rates in settings.
- [ ] **Auto-Posting & Journal Entries**:
  - Verify auto-posting generates balanced debit/credit accounting entries upon loan payment receipt.
  - Confirm journal entries reflect in `MemberFinancialSummaryService` without data discrepancies.
- [ ] **User & Collector Profile UI**:
  - Test creating and editing user profiles with collector roles.
  - Verify collector commission history and summaries on collector detail pages.

---

## 2. Borrower Financial Services - Savings, CBU & Share Capital (#58)
**Scope / Components**: `CooperativeSavingsService`, `ShareCapitalService`, `DividendService`
**UI Routes**:
- `app/(admin)/borrowers/[id].tsx`
- `app/(admin)/borrowers/[id]/savings-transactions.tsx`
- `app/(admin)/borrowers/[id]/share-capital.tsx`
- `app/(borrower)/savings-cbu.tsx`
- `app/(admin)/reports/cbu.tsx`
- `app/(admin)/reports/share-capital.tsx`

### QA Verification Checklist
- [ ] **Savings Deposit & Withdrawal**:
  - Record new savings deposit/withdrawal transactions for a borrower.
  - Check transaction history list and running balance accuracy on `savings-transactions.tsx`.
- [ ] **Share Capital & CBU**:
  - Verify share capital additions and updates reflected accurately in `share-capital.tsx`.
  - Confirm proper calculation in `DividendService` and Surplus Allocation reports (`app/(admin)/reports/surplus-allocation.tsx`).
- [ ] **CBU & Share Capital Reports**:
  - Test report generation for CBU and Share Capital summaries.
  - Validate total balances match individual borrower accounts.

---

## 3. Expenses Workflow & Encoder UI (#59)
**Scope / Components**: `app/(admin)/expenses/index.tsx`, `app/(admin)/expenses/new.tsx`, `app/(expenses-encoder)/index.tsx`

### QA Verification Checklist
- [ ] **Expense Creation (Admin & Expenses Encoder)**:
  - Create expenses under various categories/accounts.
  - Verify voucher/reference number generation via `SeriesService`.
- [ ] **Role-based Access & UI rendering**:
  - Log in as `expenses-encoder` and verify layout, restriction, and creation permissions.
  - Verify expense entries synchronize with financial statements.

---

## 4. Deployment Pipeline & Migration Verification Tools (#60)
**Scope / Components**: `scripts/deploy-pipeline.mjs`, `scripts/deploy-cloudflare.mjs`, `scripts/check-production-migrations.mjs`, `scripts/apply-all-local-migrations.mjs`

### QA Verification Checklist
- [ ] **Migration Check Utility**:
  - Run `node scripts/check-production-migrations.mjs` to verify zero pending schema collisions.
- [ ] **Local Database Sync & Seed**:
  - Run `node scripts/apply-all-local-migrations.mjs` and `node scripts/seed-test-users.mjs`.
  - Confirm clean execution without error exit codes.
- [ ] **Cloudflare Build & Deployment Verification**:
  - Execute pre-flight build check: `node scripts/deploy-pipeline.mjs --dry-run` or standard deploy test.
  - Verify web export completes cleanly with NativeWind static CSS bundle intact.

---

## 5. Financial Module Requirements & Image Transcriptions (#61)
**Scope / Components**: Fund transfers, Petty cash under COH, OR starting series 615, expense edit bug fix, legacy brand to POS Cursor branding.

---

## Automated Test Verification Command
```bash
# Run unit test suite for modified services
npx jest src/services/__tests__/CollectorCommissionService.test.ts src/services/__tests__/CooperativeSavingsService.test.ts src/services/__tests__/ShareCapitalService.test.ts src/services/__tests__/AutoPostingService.test.ts
```
