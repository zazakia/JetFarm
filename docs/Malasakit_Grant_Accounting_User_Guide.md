# MALASAKIT GRANT ACCOUNTING & USER GUIDE MANUAL
**POSCursor / POS Cursor Accounting Module**  
*Document Version:* 1.0  
*Effective Date:* August 2026  
*Target Audience:* Admins, Accounting Encoders, Bookkeepers, and Finance Officers  

---

## TABLE OF CONTENTS
1. [Executive Summary & Purpose](#1-executive-summary--purpose)
2. [Accounting Framework & CDA Alignment](#2-accounting-framework--cda-alignment)
3. [Chart of Accounts (COA) Setup & Account Linking](#3-chart-of-accounts-coa-setup--account-linking)
4. [Step-by-Step Encoding Guide for ₱100,000 Malasakit Grant](#4-step-by-step-encoding-guide-for-100000-malasakit-grant)
   - [Step 4.1: Verify & Create Required Accounts](#step-41-verify--create-required-accounts)
   - [Step 4.2: Encode the Manual Journal Entry](#step-42-encode-the-manual-journal-entry)
   - [Step 4.3: Verify Posting in General Ledger](#step-43-verify-posting-in-general-ledger)
   - [Step 4.4: Validate Trial Balance & Dashboard Reconciliation](#step-44-validate-trial-balance--dashboard-reconciliation)
5. [Deep Dive into the POS Cursor Accounting Module](#5-deep-dive-into-the-poscursor-accounting-module)
   - [5.1 Double-Entry Bookkeeping Principles](#51-double-entry-bookkeeping-principles)
   - [5.2 Account Hierarchy (CDA 4-Digit Standard)](#52-account-hierarchy-cda-4-digit-standard)
   - [5.3 Automatic vs. Manual Journal Postings](#53-automatic-vs-manual-journal-postings)
   - [5.4 Data Integrity, Reversal Rules & Audit Trail](#54-data-integrity-reversal-rules--audit-trail)
6. [Troubleshooting & Frequently Asked Questions](#6-troubleshooting--frequently-asked-questions)

---

## 1. EXECUTIVE SUMMARY & PURPOSE

This user guide provides complete operational and accounting instructions for recording a **₱100,000.00 Malasakit Grant / Subsidy** within the **POS Cursor / POSCursor Management System**.

The **Malasakit Grant** represents financial assistance received from government agencies (e.g., DSWD Malasakit Program, DTI, LGU, or CDA Grant Funds) intended to support cooperative operations, member welfare, or community livelihood programs. 

Properly encoding this transaction ensures:
- **Compliance with CDA (Cooperative Development Authority)** accounting standards.
- **Accurate Balance Sheet & Income Statement** financial reporting.
- **Audit-ready trial balance reconciliation** across WatermelonDB local persistence and Supabase backend cloud sync.

---

## 2. ACCOUNTING FRAMEWORK & CDA ALIGNMENT

Under standard Philippine Cooperative Accounting (CDA Financial Reporting Framework) and Philippine Financial Reporting Standards (PFRS for SMEs / PAS 20), government grants can be categorized under two recognition methods:

### Method A: Revenue Recognition Method (Recommended for Operational Grants)
Use this method when the grant is provided to cover general operating expenses, member subsidy programs, or non-restricted operational activities.
- **Asset Account**: Increase Cash in Bank or Cash on Hand (Debit).
- **Income Account**: Increase Grants & Subsidies Income (Credit).

| Account Code | Account Title | Type | Normal Balance | Debit (₱) | Credit (₱) |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **1020** (or 1010) | Cash in Bank — BDO (or Cash on Hand) | Asset | Debit | **100,000.00** | — |
| **4080** (or 4060) | Grants & Subsidies Income | Income | Credit | — | **100,000.00** |

### Method B: Donated Equity / Capital Method (For Capital / Restricted Grants)
Use this method if the grant is specifically mandated by the grantor agency to be held as permanent cooperative capital or a restricted fund balance.
- **Asset Account**: Increase Cash in Bank (Debit).
- **Equity Account**: Increase Optional Fund / Donated Capital (Credit).

| Account Code | Account Title | Type | Normal Balance | Debit (₱) | Credit (₱) |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **1020** | Cash in Bank — BDO | Asset | Debit | **100,000.00** | — |
| **3050** (or 3070) | Optional Fund — Malasakit Grant | Equity | Credit | — | **100,000.00** |

---

## 3. CHART OF ACCOUNTS (COA) SETUP & ACCOUNT LINKING

The POS Cursor accounting system strictly validates that all journal entry lines link to **active, postable (non-header)** account codes in the Chart of Accounts.

### System Standard CDA Account Ranges:
- **1000–1999**: ASSETS (Normal Balance: Debit)
- **2000–2999**: LIABILITIES (Normal Balance: Credit)
- **3000–3999**: EQUITY / FUND BALANCES (Normal Balance: Credit)
- **4000–4999**: INCOME (Normal Balance: Credit)
- **5000–5999**: EXPENSES (Normal Balance: Debit)

### Recommended Target Accounts for Malasakit Grant:

| Code | Account Name | Type | Header? | Postable? | Parent Code | Description |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **1020** | Cash in Bank — BDO | Asset | No | **Yes** | `1000` | Bank account receiving grant deposit |
| **1010** | Cash on Hand (COH) | Asset | No | **Yes** | `1000` | Alternative if received in cash |
| **4080** | Grants & Subsidies Income | Income | No | **Yes** | `4000` | Recognition of unearned/earned grants |
| **4060** | Other Income | Income | No | **Yes** | `4000` | Alternative general income account |
| **3050** | Optional Fund | Equity | No | **Yes** | `3000` | Cooperative restricted grant fund balance |

---

## 4. STEP-BY-STEP ENCODING GUIDE FOR ₱100,000 MALASAKIT GRANT

### Step 4.1: Verify & Create Required Accounts
1. Log in to **POS Cursor / POSCursor** as an **Admin** or **Finance Officer**.
2. Navigate to **Accounting** from the main menu (`(admin)/accounting`).
3. Tap **Chart of Accounts** (`/accounting/chart-of-accounts`).
4. Search for account code `4080` (Grants & Subsidies Income).
5. **If account `4080` does NOT exist**, tap **+ Add Account** and enter:
   - **Account Code:** `4080`
   - **Account Name:** `Grants & Subsidies Income`
   - **Account Type:** `Income`
   - **Normal Balance:** `Credit`
   - **Parent Account Code:** `4000`
   - **Is Header Account:** Unchecked (False)
   - **Description:** `Income from government and NGO grants including Malasakit Program`
   - **Sort Order:** `308`
6. Tap **Create Account**.

---

### Step 4.2: Encode the Manual Journal Entry
1. In the Accounting section, navigate to **Journal Entries** (`/accounting/journal-entries`).
2. Tap **+ New Journal Entry**.
3. Fill out the header information:
   - **Entry Date:** Select the date the grant funds were received (e.g., `2026-08-07`).
   - **Entry Description:** `Receipt of Malasakit Grant Funds worth ₱100,000.00 for Cooperative Operations`.
   - **Entry Type:** Select `manual` (Manual Journal Entry).
4. Configure **Line Item 1 (Debit)**:
   - **Account Code:** Select `1020 - Cash in Bank — BDO` (or `1010`).
   - **Debit Amount (₱):** `100000.00`
   - **Credit Amount (₱):** `0.00`
   - **Line Memo:** `Deposit of Malasakit Grant funds into BDO Account`.
5. Configure **Line Item 2 (Credit)**:
   - **Account Code:** Select `4080 - Grants & Subsidies Income` (or `3050 Optional Fund`).
   - **Debit Amount (₱):** `0.00`
   - **Credit Amount (₱):** `100000.00`
   - **Line Memo:** `Recognition of ₱100,000 Malasakit Grant income`.
6. **Verify Balance Indicator**:
   - Total Debits: **₱100,000.00**
   - Total Credits: **₱100,000.00**
   - Imbalance: **₱0.00** *(System enforces exact balance before posting)*.
7. Tap **Post Journal Entry**.
8. System generates reference number: `JE-2026-XXXXXX`.

---

### Step 4.3: Verify Posting in General Ledger
1. Navigate to **General Ledger** (`/accounting/general-ledger`).
2. Select Account **1020 (Cash in Bank — BDO)**:
   - Verify a new line item exists with reference `JE-2026-XXXXXX`.
   - Confirm Debit shows `+₱100,000.00`, increasing cash balance.
3. Select Account **4080 (Grants & Subsidies Income)**:
   - Verify line item exists with reference `JE-2026-XXXXXX`.
   - Confirm Credit shows `+₱100,000.00`, increasing total income.

---

### Step 4.4: Validate Trial Balance & Dashboard Reconciliation
1. Navigate to **Trial Balance** (`/accounting/trial-balance`).
2. Verify that **Total Debits equal Total Credits**.
3. Return to **Accounting Overview** (`/accounting/index`).
4. If necessary, tap **Reconcile DB** to trigger `AutoPostingService.backfillUnpostedTransactions()` to ensure WatermelonDB offline storage and Supabase cloud sync are fully in sync.

---

## 5. DEEP DIVE INTO THE POSCURSOR ACCOUNTING MODULE

### 5.1 Double-Entry Bookkeeping Principles
POS Cursor implements a strict double-entry ledger architecture. Every business transaction must contain at least two entries (one debit and one credit) where:
$$\sum \text{Debits} = \sum \text{Credits}$$

### 5.2 Account Hierarchy (CDA 4-Digit Standard)
Accounts are structured hierarchically:
- **Header Accounts** (e.g., `1000 ASSETS`, `4000 INCOME`): Used for categorization and reporting totals. Postings to header accounts are blocked.
- **Detail / Postable Accounts** (e.g., `1020`, `4080`): Leaf nodes where financial postings occur.

### 5.3 Automatic vs. Manual Journal Postings
1. **Automated Postings (`auto`)**:
   - Triggered by operational events (Loan Disbursements, Repayments, Expense Encoding).
   - Processed via `AutoPostingService` and `ModuleAccountingBridge`.
2. **Manual Journal Entries (`manual`)**:
   - Used for non-routine transactions, grants, capital contributions, and year-end adjustments.

### 5.4 Data Integrity, Reversal Rules & Audit Trail
- **Immutability**: Once a journal entry is posted, it cannot be deleted or directly modified.
- **Reversal Policy**: To correct an erroneous entry, select the entry in `/accounting/journal-entries` and tap **Post Reversal**. The system will automatically create an inverted journal entry (`entry_type: 'reversing'`) with negated debits and credits.
- **Deterministic ID Generation**: All Chart of Accounts IDs use deterministic MD5 UUID v4 mapping derived from account codes, preventing sync conflicts across offline mobile devices.

---

## 6. TROUBLESHOOTING & FREQUENTLY ASKED QUESTIONS

### Q1: The system gave an error: "Journal entry is not balanced".
**Solution:** Ensure total debit amount equals total credit amount exactly. Double-check for typing errors or extra line items.

### Q2: Account code 4080 does not appear in the journal entry dropdown list.
**Solution:** Check the Chart of Accounts. Ensure account 4080 has `is_header = false` and `is_active = true`. Header accounts cannot accept direct transaction postings.

### Q3: How do I handle partial spending of the Grant?
**Solution:** When grant funds are spent for office supplies or member assistance, record normal expense entries (Debit: `5020 Office Expenses`, Credit: `1020 Cash in Bank — BDO`). The initial grant entry remains unchanged in revenue/equity.

---
*End of Manual — POS Cursor / POSCursor Accounting Documentation*
