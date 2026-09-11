# [Requirements & Bug Fixes] Financial Module Updates & Accounting Workflows

## Overview
This issue tracks the explicit requirements, accounting updates, and bug fixes transcribed from the reference document photo (August 2026).

---

## 📋 Action Items & Feature Checklist

### 1. Initial Balances & Accounting Adjustments (Jan 1, 2026)
- [ ] **Loan Receivable Baseline**: Establish Loan Balance as of Jan 1, 2026 based on `onDLLoaner2026` dataset (less cash on hand, add to Loan Receivable).
- [ ] **CBU & Savings (2025 Baseline)**: Set CBU and Savings based on 2025 baseline data — verify integration to Cash on Hand (COH) and add Share Capital credit entries.
- [ ] **Official Receipt (OR) Series**: Set starting OR series number to **615** in `SeriesService`.
- [ ] **Miscellaneous Income Breakdown**: Map Membership Fee, Passbook Fee, and System Fee to Miscellaneous Income accounts.

### 2. Fund Transfer Module & Bank Transactions
- [ ] **Source of Funds Transfer Module**: Build dedicated Transfer Module for managing source of funds.
- [ ] **Fund Transfer (COH to Petty Cash / Cash in Bank)**: Enable direct transfers from Cash on Hand (COH) to Petty Cash or Cash in Bank (CIB).
- [ ] **Bank Account Withdrawal**: Add transaction capability to record Bank Account Withdrawals to Cash on Hand (CIB → COH).

### 3. Chart of Accounts & Collector Commission Updates
- [ ] **Add Petty Cash Account**: Add "Petty Cash" account under Cash on Hand (COH) in the Chart of Accounts.
- [ ] **COA Deletion Protection**: Prevent deletion of newly created custom Chart of Accounts entries ("No Delete" rule).
- [ ] **Collector as Member**: Allow collectors to be associated as members with configurable commission percentage share per collection.

### 4. Bug Fixes & Rebranding
- [ ] **Expenses Update Fix**: Resolve bug where existing expense records cannot be edited/updated (`In expenses cant update`).
- [ ] **legacy brand to POS Cursor Migration**: Ensure all remaining UI strings, branding constants, and documentation are migrated from legacy brand to **POS Cursor**.

---

## Automated & Manual Verification
- Unit test coverage for `ChartOfAccountsService`, `CollectorCommissionService`, `SeriesService`, and `PaymentService`.
- E2E / manual testing of fund transfers and expense updating in web export.
