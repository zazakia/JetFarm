# POSCURSOR-CCF SAVINGS AND CREDIT COOPERATIVE (SCSCC)
## Infinity Finance — Lending Management System (LMS)
### System User Manual

---

**Application:** Infinity Finance LMS  
**Cooperative:** POS Cursor-CCF Savings and Credit Cooperative (SCSCC)  
**Platform:** Mobile (iOS / Android) + Web  
**Currency:** Philippine Peso (₱)  
**Version:** 1.0  
**Prepared:** July 2026  

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Getting Started — Login & Access](#2-getting-started--login--access)
3. [Interface Features & Conventions](#3-interface-features--conventions)
4. [Role: Administrator](#4-role-administrator)
5. [Role: Collector](#5-role-collector)
6. [Role: Loan Encoder](#6-role-loan-encoder)
7. [Role: Payment Encoder](#7-role-payment-encoder)
8. [Role: Expenses Encoder](#8-role-expenses-encoder)
9. [Role: Borrower](#9-role-borrower)
10. [Business Rules Reference](#10-business-rules-reference)
11. [Financial Formulas & KPI Definitions](#11-financial-formulas--kpi-definitions)
12. [Offline-First Operations](#12-offline-first-operations)
13. [Data Sync & Cloud Backup](#13-data-sync--cloud-backup)
14. [Glossary](#14-glossary)

---

## 1. SYSTEM OVERVIEW

### 1.1 What is Infinity Finance LMS?

Infinity Finance is a **mobile-first lending and microfinance management system** built for POS Cursor-CCF Savings and Credit Cooperative (SCSCC). It enables collectors, loan officers, administrators, and borrowers to manage the full loan lifecycle — even without an internet connection.

### 1.2 Core Capabilities

| Feature | Description |
|---------|-------------|
| **Offline-First** | All operations work without internet; data syncs automatically when online |
| **Role-Based Access** | 6 distinct roles, each with its own portal and permissions |
| **Encrypted PII** | Borrower address and phone number are encrypted at rest on the device |
| **Automated Calculations** | Flat and diminishing interest, payment schedules, penalties auto-computed |
| **Collection Sheets** | Daily, weekly, and custom collection route management |
| **Remittance Tracking** | Full audit trail from collection to admin deposit acknowledgment |
| **Financial KPIs** | PAR, OSS, collection efficiency, disbursement totals auto-calculated |
| **Reports** | 35+ report screens covering income statements, balance sheets, aging, dividends |
| **Sunlight Mode** | Neobrutalist high-contrast UI for field use under direct sunlight |

### 1.3 System Architecture (Non-Technical Summary)

The app stores all data **locally on your device** in an offline database (SQLite). When you connect to the internet, the app automatically synchronizes your local records with the cooperative's cloud server (Supabase). This means:

- You will **never lose work** from going offline mid-operation.
- All changes are queued locally and uploaded as soon as connectivity is restored.
- Multiple users can work simultaneously; conflicts are resolved by the sync engine.

---

## 2. GETTING STARTED — LOGIN & ACCESS

### 2.1 Launching the App

1. Open the **Infinity Finance** app on your device.
2. The app will show a loading screen while it initializes the local database and checks for an active session.
3. If you have a saved session, you will be taken directly to your role's dashboard.

### 2.2 Logging In

**Step 1:** On the Login screen, enter your registered **Email Address**.  
**Step 2:** Enter your **Password**.  
**Step 3:** Tap **Sign In**.  
**Step 4:** The app will verify your credentials and redirect you to the appropriate role portal.

> **Note:** If login fails, check your internet connection. First-time login always requires internet access to verify your account. Subsequent logins can use locally cached credentials.

### 2.3 Logging Out

- Tap the **Logout icon** (→ door icon) in the top-right corner of your dashboard.
- You will be signed out and returned to the Login screen.

### 2.4 User Roles

| Role | Default Access |
|------|---------------|
| **Admin** | Full system access: all borrowers, all loans, reports, settings, approvals |
| **Collector** | Their assigned borrowers only; collection sheets; remittances |
| **Loan Encoder** | Create and manage loans; view borrower history |
| **Payment Encoder** | Post payments to active loans |
| **Expenses Encoder** | Record operational expenses |
| **Borrower** | View their own loan status, payment schedule, profile |

---

## 3. INTERFACE FEATURES & CONVENTIONS

### 3.1 Sunlight Mode

Sunlight Mode is a **high-contrast neobrutalist display setting** designed for field collectors who work outdoors in bright sunlight, where standard screens may be hard to read.

**How to Toggle Sunlight Mode:**
1. Tap the **Sun icon** (☀) in the top-right area of the Collector or Admin dashboard header.
2. The interface immediately switches between:
   - **Standard Mode**: Dark green gradient header, soft colors.
   - **Sunlight Mode**: Stark white background, thick black borders, heavy black typography — maximum readability.

> **Tip:** Enable Sunlight Mode during outdoor field collection routes. Return to standard mode indoors for a more comfortable viewing experience.

### 3.2 Sync Status Badges

Sync status is always visible at the top of the screen:

| Badge | Meaning |
|-------|---------|
| 🟢 **Online / Synced** | Your local data is up-to-date with the server |
| 🟡 **Syncing...** | A sync operation is in progress |
| 🔴 **Offline** | No internet connection; changes are saved locally |
| 🔵 **Pending** | You have local changes that have not yet been uploaded |

### 3.3 Pull-to-Refresh

On any list or dashboard screen, **pull down** with your finger to manually refresh data from the local database.

### 3.4 Currency Display

All monetary values in the app are displayed in **Philippine Peso (₱)**. Example: `₱10,000.00`.

### 3.5 Navigation Patterns

- The app uses **tab-based navigation** on the bottom of role dashboards.
- Deep screens use a **Back arrow** (←) on the top-left.
- Action buttons are prominently placed as large colored tiles on dashboards.

---

## 4. ROLE: ADMINISTRATOR

### 4.1 Admin Dashboard Overview

The Admin Dashboard is the **command center** of the LMS. It displays real-time KPIs, portfolio performance charts, a delinquency watchlist, and quick access to all management modules.

**Dashboard KPI Cards** (tap any card to see a breakdown):

| KPI Card | What it Shows |
|----------|--------------|
| **Active Loans** | Count of loans currently in `active` or `defaulted` status |
| **Weekly Target** | Total installment amounts scheduled for this week |
| **Outstanding** | Total remaining balance across all active + defaulted loans, including penalties |
| **Total Disbursed** | Sum of all principals released to borrowers (active, paid, defaulted) |
| **Overdue (PAR>30)** | Principal balance of loans with payments more than 30 days past due |
| **Collected Today** | Total payments received today |
| **This Month** | Total payments received in the current calendar month |
| **Cash on Hand** | Current net cash balance in the vault (receipts minus expenses/disbursements) |
| **Borrowers** | Total count of registered borrowers in the system |
| **Daily Portfolio** | Aggregated metrics for loans with daily payment frequency |
| **Weekly Portfolio** | Aggregated metrics for loans with weekly payment frequency |

### 4.2 Lending Performance Chart

Below the KPI cards, a **weekly collection bar chart** shows daily collection amounts for the current week (Monday–Sunday) for both daily and weekly portfolio loans. This helps identify collection gaps day by day.

### 4.3 Delinquency Watchlist

The **Overdue Watchlist** section lists individual borrowers with overdue payment schedules, showing:
- Borrower name
- Days overdue
- Amount due
- Loan balance
- Direct call/message shortcut (phone number)

The watchlist groups accounts into **Aging Buckets**:

| Bucket | Days Overdue |
|--------|-------------|
| 1–30 days | Early warning |
| 31–60 days | Moderate risk |
| 61–90 days | High risk |
| 90+ days | Write-off risk |

### 4.4 Admin Module Navigation

#### 4.4.1 Borrowers
- View all registered borrowers across all collectors.
- Search by name.
- View borrower profile, loan history, and payment records.

#### 4.4.2 Loans
- View all loans across all collectors.
- Filter by status: `pending`, `active`, `closed`, `defaulted`.
- View individual loan details including schedule, payments made, and remaining balance.

#### 4.4.3 Loan Approvals
- Review loans submitted with `pending` status.

**Step-by-Step: Approving a Loan**
1. Tap **Loan Approvals** from the Admin sidebar.
2. View the list of pending loans.
3. Tap a loan to view its full details and borrower credit profile.
4. Tap **Approve** to activate the loan and generate payment schedules, or **Reject** to return it.

> **Business Rule:** All loan applications must be evaluated and approved by the Credit Committee / Admin before becoming active. No disbursements occur without explicit approval.

#### 4.4.4 Payments
- View all payment records system-wide.
- Filter by date range, collector, or borrower.

#### 4.4.5 Remittances
- Review pending cash remittances submitted by collectors.

**Step-by-Step: Reviewing a Remittance**
1. Tap **Remittances** from the Admin nav.
2. See all `pending` remittances sorted by date (newest first).
3. Tap a remittance to view the collector name, amount, and date.
4. Tap **Approve** to confirm receipt of cash, or **Reject** to send it back.
5. Approved remittances add the remitted amount to the cooperative's **Cash on Hand** balance.

#### 4.4.6 Collectors
- View all registered collector accounts.
- Assign borrowers to collectors.
- Manage collector area assignments.

#### 4.4.7 Users
- Manage all user accounts (create, activate, deactivate).
- Assign roles to new users.

#### 4.4.8 Areas
- Manage geographic areas/routes for borrower assignment.

#### 4.4.9 Groups
- Manage borrower group assignments (for group lending).

#### 4.4.10 Expenses
- View all recorded operational expenses.

#### 4.4.11 File Cases
- View and manage delinquency file cases opened against defaulting borrowers.

#### 4.4.12 Bank Accounts
- Manage the cooperative's bank account records for remittance and deposit tracking.

#### 4.4.13 Cash on Hand
- View the real-time cash balance in the vault.
- Review the detailed cash transaction history.

#### 4.4.14 Payroll
- Manage staff payroll records and disbursements.

#### 4.4.15 Settings
- Configure system-level settings including loan product presets, interest rates, and cooperative information.

### 4.5 Admin Reports (35+ Reports)

Access via the **Reports** tab. Available reports:

| Report | Description |
|--------|-------------|
| **Dashboard** | Executive summary with all KPIs |
| **Active Loans** | Full active loan portfolio listing |
| **Daily Collection** | Payments received today per collector |
| **Weekly Collection** | Weekly collection summary per collector |
| **Collection** | All-time collection summary |
| **Collection Logs** | Detailed log of every payment transaction |
| **Collector Efficiency** | Each collector's collection rate vs. target |
| **MFI KPIs** | Industry-standard microfinance performance indicators |
| **PAR (Portfolio at Risk)** | PAR>30 ratio and aging analysis |
| **Portfolio Aging** | Aging schedule of all outstanding balances |
| **Aging** | Account aging summary |
| **Past Due** | All overdue accounts |
| **Delinquent Accounts** | Severely overdue / defaulted accounts |
| **Financial Summary** | Combined income and balance overview |
| **Income Statement** | Revenue vs. expenses for a selected period |
| **Balance Sheet** | Assets, liabilities, and equity snapshot |
| **Cash Flows** | Statement of cash inflows and outflows |
| **Changes in Equity** | Equity movement statement |
| **Disbursements** | All loan releases in a period |
| **Renewals** | Reloan / renewal history |
| **Savings** | Borrower savings balance summary |
| **Share Capital** | Member share capital summary |
| **CBU (Capital Build-Up)** | Individual CBU tracking |
| **Dividends** | Dividend distribution records |
| **Statutory Reserves** | Required reserve fund status |
| **Membership** | Active/inactive member count |
| **Expenses** | Operational expense breakdown |
| **Monthly Receipts** | Monthly payment receipt summary |
| **Monthly Sales** | Monthly loan disbursement volume |
| **SOA Masterlist** | Statement of Account for all borrowers |
| **Audit** | System audit trail and discrepancy report |
| **Excess Cash Receipts** | Excess cash collected beyond installment |
| **Creditors Group Life** | Group life insurance summary |
| **Cash Advances** | Cash advance tracking |
| **Bank Export** | Data export for bank submission |

---

## 5. ROLE: COLLECTOR

### 5.1 Collector Dashboard Overview

The Collector Portal is designed for **field agents** who collect daily or weekly payments from borrowers. The dashboard shows:

- **Greeting header** with collector's name and time-of-day salutation
- **Daily Goal Progress Bar**: Shows ₱Collected Today / ₱Target Today and efficiency percentage
- **KPI Cards**: Active Cases, Efficiency %, Outstanding Balance, Collected Today
- **My Borrowers**: Scrollable list of all assigned borrowers (searchable)

### 5.2 Action Cards on Dashboard

| Action Card | What it Does |
|-------------|-------------|
| **Field List** (Daily Route) | Opens the Collection Sheet — all due payments for the selected date |
| **Remit Cash** (Submit Funds) | Opens the Remittance submission form |
| **Daily Sheet** | Opens the simplified Daily Collection Sheet |
| **Weekly Sheet** | Opens the Weekly Collection Summary |
| **Submit Daily Log** | Opens the Daily Activity Log submission form |

### 5.3 Collection Sheet (Field List)

The Collection Sheet is the **primary tool for field collection**. It lists every borrower with a payment due on the selected date.

**Step-by-Step: Recording a Payment on the Collection Sheet**

1. From the Collector Dashboard, tap **Field List**.
2. The collection sheet loads all borrowers with **pending or overdue schedules** up to today.
3. Use the **date picker** to select the collection date (defaults to today).
4. Use the **search bar** to filter borrowers by name.
5. Scroll through the borrower list. Each row shows:
   - Borrower name
   - Loan number
   - Amount due (installment amount)
   - Schedule due date
   - Overdue indicator (🔴 if past due)
6. Tap a borrower row to open the **Payment Entry Modal**.
7. In the modal:
   - **Amount**: Pre-filled with the installment amount. Edit if the borrower pays a different amount (partial or excess).
   - **Payment Method**: Select `Cash` or `GCash` (reference number field appears for GCash).
   - **Reference Number**: Enter the GCash/bank reference number if applicable.
8. Tap **Mark as Paid** to record the payment.
9. The row turns green / disappears from the list. The daily collection total updates.

> **Business Rule:** Payments are saved immediately to the local database. They are uploaded to the cloud on next sync. Collectors can record payments offline with no data loss.

**Collection Sheet Totals Banner:**
- **Target**: Total scheduled amount for all items in the list
- **Count**: Number of borrowers in the list
- **Overdue**: Number of past-due items (red indicator)

### 5.4 Daily Collection Sheet

A simplified view of the daily collection filtered for the **current day only**, useful for a quick progress overview.

### 5.5 Weekly Collection Sheet

Shows the full week's (Mon–Sun) collection schedule. Allows the collector to plan their route and track daily progress across the full week.

### 5.6 Daily Log

The Daily Log is a **required end-of-day report** that collectors submit to administration.

**Step-by-Step: Submitting the Daily Log**

1. From the dashboard, tap **Submit Daily Log**.
2. Fill in the following fields:
   - **Total Cash Collected** (auto-populated if synced)
   - **Notes / Remarks** (any incidents, missed collections, borrower updates)
   - **Date** (defaults to today)
3. Tap **Submit**.
4. The log is saved and will sync to the admin's view.

### 5.7 Cash Remittance

After completing daily collections, the collector must **remit (hand over) all collected cash** to the cooperative office.

**Step-by-Step: Submitting a Remittance**

1. From the dashboard, tap **Remit Cash**.
2. The remittance form loads:
   - **Amount**: Enter the total cash amount being handed over.
   - **Date**: Defaults to today.
   - **Notes**: Any remarks about the remittance.
3. Tap **Submit Remittance**.
4. The remittance record is created with status `pending` and queued for Admin approval.
5. The Admin will review and approve or reject the remittance (see Section 4.4.5).

> **Business Rule:** Collectors must remit all collected cash daily. Cash remittances are not considered received until the Admin approves them. The cooperative's Cash on Hand balance only increases upon Admin approval.

### 5.8 Borrowers Sub-Screen

Accessible from the Collector Dashboard's "My Borrowers" section. Tap any borrower card to view:
- Borrower profile (name, area, phone)
- All loans (active, closed, defaulted)
- Payment history
- Outstanding balance

---

## 6. ROLE: LOAN ENCODER

### 6.1 Loan Encoder Dashboard Overview

The Loan Encoder creates new loan records and manages loan applications. The dashboard is a **loan entry form** with a summary of recently processed loans.

### 6.2 Creating a New Loan — Step by Step

**Step 1: Select Borrower**
1. Tap **Select Borrower** at the top of the form.
2. A borrower search modal opens. Search by name and tap to select.
3. Once selected, the system automatically:
   - Checks for any existing active loans for this borrower.
   - If an active loan exists, the form pre-fills `isReloan = true` and links to the previous loan.
   - Auto-populates the principal from the borrower's loan code if configured.

**Step 2: Select Loan Type**

Tap the loan type selector. Available types:

| Loan Type | Description |
|-----------|-------------|
| Standard Micro Loan | General microfinance loan with flat computation |
| Petty Cash Loan | Short-term, share-capital-based |
| Livelihood Loan | Self-employed members |
| Salary Loan | Employed members |
| Emergency Loan | Urgent needs with collateral |

> Selecting a loan type **automatically pre-fills** the default rate, term, term unit, frequency, and fees per the loan product preset.

**Step 3: Enter Loan Parameters**

| Field | Description | Validation |
|-------|-------------|------------|
| **Principal** | Loan amount in ₱ | Must be > 0; must not exceed max principal for loan type |
| **Interest Rate (%)** | Monthly interest rate | Cannot be negative |
| **Term** | Loan duration | Must be > 0; must match term rules for loan type |
| **Term Unit** | `Months`, `Weeks`, or `Days` | Institutional loans require months |
| **Interest Type** | `Flat` or `Diminishing` | |
| **Frequency** | `Daily`, `Weekly`, `Bi-Monthly`, `Monthly` | |
| **Deposit** | Security/savings deposit per payment | Auto-calculated: 1% of principal × number of payments |
| **Insurance** | Insurance fee per payment | Auto-calculated from insurance table; ₱10 × payments for weekly loans |
| **Savings Per Payment** | Additional savings collected per installment | |
| **Processing Fee** | One-time processing fee | Auto-calculated from loan type preset rate × principal |
| **Collection Fee** | Collection fee | |
| **Notarial Fee** | Notarization fee (if applicable) | Auto-calculated from loan type preset |
| **Release Date** | Loan disbursement date | Required; defaults to today |

**Step 4: Review Loan Calculation**

A **Calculation Basis Card** appears showing:
- Total Amount (Principal + Total Interest)
- Total Interest
- Installment Amount per payment
- Number of payments
- Maturity Date

The calculation updates live as you change any parameter.

**Step 5: Handle Reloan (if applicable)**

If this borrower has an existing active loan:
- A **Reloan Alert** appears showing the active loan's outstanding balance.
- The **Net Amount Released** = New Principal − Outstanding Balance of previous loan.
- Tap **Confirm Reloan** to acknowledge. The previous loan balance will be deducted from the new loan release amount.

**Step 6: Audit Check**

Before saving, the system runs an **Audit Check** that flags:
- Duplicate loan types for the same borrower
- Unusual parameter combinations
- Critical issues that could cause calculation errors

If critical issues are found, a report is shown. Tap **Proceed Anyway** (for non-critical) or fix the flagged issues first.

**Step 7: Save the Loan**

1. Tap **Save Loan** (or **Submit for Approval**).
2. The loan is saved with status `pending` and queued for Admin approval.
3. Upon Admin approval, the status changes to `active` and payment schedules are automatically generated.

### 6.3 Viewing Loan Applications

From the **Loan Applications** sub-section, the encoder can view:
- All loans they have created
- Current status of each loan (`pending`, `active`, `closed`, `defaulted`)
- Filter and search by borrower or date

### 6.4 Viewing All Loans

The **Loans** sub-section shows all loans in the system accessible to the encoder.

---

## 7. ROLE: PAYMENT ENCODER

### 7.1 Payment Encoder Dashboard Overview

The Payment Encoder records **manual payments** against active loans. This role is typically used in-office when borrowers pay in person or via bank transfer.

### 7.2 Recording a Payment — Step by Step

**Step 1: Select Borrower**
1. Tap **Select Borrower**.
2. Search and select the borrower from the modal.
3. The system loads all **active loans** for that borrower.

> **Access Control:** If the user is a collector role posting via this screen, the system verifies that the selected borrower is assigned to their collector account. Access is denied if the borrower is not their assignment.

**Step 2: Select Loan**
1. From the list of active loans, tap the correct loan (identified by loan number and installment amount).
2. The **Amount** field auto-fills with the loan's standard installment amount.

**Step 3: Enter Payment Details**

| Field | Description |
|-------|-------------|
| **Amount** | Payment amount in ₱. Default = installment amount. Can be edited for partial or excess payments. |
| **Payment Date** | Date the payment was made. Defaults to today. |
| **Receipt Number** | Auto-generated receipt number. Can be overridden. |
| **Current Salary** | Optional. If the borrower's current salary is entered, the system calculates any Excess Cash Receipt. |
| **Notes** | Optional remarks. |

**Step 4: Excess Cash Receipt Calculation**

If `Current Salary` is entered and the payment amount exceeds the installment, the system automatically calculates:
- **Excess Cash** = Payment Amount − Installment Amount
- An excess cash receipt is generated and linked to the payment record.

**Step 5: Save Payment**
1. Tap **Save Payment**.
2. A confirmation dialog appears with a summary.
3. Tap **Confirm** to post the payment.
4. The payment is saved locally and synced to the cloud.
5. The form resets with a new auto-generated receipt number.

> **Business Rule:** Payments are applied to the earliest unpaid installment in the payment schedule. Overpayments are recorded as excess cash receipts. The payment schedule status updates automatically (`pending` → `paid` or `partial`).

---

## 8. ROLE: EXPENSES ENCODER

### 8.1 Expenses Encoder Dashboard Overview

The Expenses Encoder records **operational expenses** for the cooperative. The dashboard shows:
- This month's total expenses
- Recent expenses list (last 5 records)
- Expense entry form

### 8.2 Recording an Expense — Step by Step

**Step 1: Select Category**

Available expense categories:

| Category | Icon |
|----------|------|
| Transportation | 🚗 |
| Office Supplies | 📦 |
| Rent/Utilities | 🏠 |
| Marketing | 📢 |
| Taxes/Fees | 🏛 |
| Other | ⋯ |

> **Note:** Custom categories can be created by the Admin in Settings → Expense Categories. Only active categories appear in the selector.

**Step 2: Set Frequency (Optional)**

| Frequency | Meaning |
|-----------|---------|
| `none` | One-time expense |
| `daily` | Recurring daily expense |
| `weekly` | Recurring weekly expense |

**Step 3: Enter Expense Details**

| Field | Description |
|-------|-------------|
| **Amount** | Expense amount in ₱ (must be > 0) |
| **Payee** | Name of vendor/supplier (optional) |
| **TIN** | Supplier's Tax Identification Number (optional) |
| **Invoice Number** | Invoice or OR number (optional) |
| **VAT Amount** | Applicable VAT in ₱ (optional) |
| **Description** | Free-text details about the expense |

**Step 4: Save Expense**
1. Tap **Save**.
2. The expense is recorded and immediately appears in the Recent Expenses list.
3. The monthly total updates automatically.

### 8.3 Expense Categories Management

From the **Categories** sub-screen:
1. View all active and inactive expense categories.
2. Add new custom categories by entering a category name.
3. Deactivate categories that are no longer needed.

### 8.4 Receipts

From the **Receipts** sub-screen:
1. View a list of all recorded expense receipts.
2. Tap a receipt to view its full details.

---

## 9. ROLE: BORROWER

### 9.1 Borrower Portal Dashboard Overview

The Borrower Portal gives **registered borrowers** a self-service view of their own account. The dashboard shows:

- **Total Outstanding Balance** (all active loans combined)
- **Active Loans Count**
- **Next Installment Amount**
- **Payment Countdown**: Days until next payment due (orange alert if ≤ 3 days)

### 9.2 Quick Actions

| Button | Action |
|--------|--------|
| **My Loans** | View all loans (active, paid, defaulted) |
| **My Transactions** | View full payment history |
| **My Documents** | View uploaded loan documents |
| **My Profile** | View and manage personal profile |

### 9.3 Viewing Loans

From **My Loans**:
1. All loans are listed with their status badge.
2. Tap a loan to see:
   - Loan number and type
   - Principal, interest rate, term
   - Total amount, installment amount
   - Release date and maturity date
   - Payment schedule (each installment with status: `pending`, `paid`, `partial`, `late`)

### 9.4 Viewing Transactions

From **My Transactions**:
1. All payment records are listed in reverse chronological order.
2. Each record shows: payment date, amount paid, receipt number, and collector.

### 9.5 Viewing Documents

From **My Documents**:
1. View loan-related documents submitted or uploaded by the office.

### 9.6 Managing Profile

From **My Profile**:
1. View personal information on file: full name, address, phone number, date of birth, gender.
2. Contact the office to update personal information (borrowers cannot edit directly).

---

## 10. BUSINESS RULES REFERENCE

### 10.1 Membership Rules

#### Pre-Membership Education Seminar (PMES)

**Rule:** Before any person can apply for membership, they must complete the prescribed PMES.

**Process:**
1. Applicant attends the scheduled PMES session.
2. Applicant fills up the Participant's Profile form during PMES.
3. PMES completion certificate is issued.
4. Applicant proceeds to membership application.

#### Regular Membership Application

**Rule:** Regular membership is open to applicants who have completed PMES.

**Step-by-Step Process:**
1. Applicant submits a completed **Membership Application Form**.
2. Applicant pays the **non-refundable membership fee of ₱200.00**.
3. The Education and Training Committee (ETC) reviews and recommends the application.
4. The **Board of Directors (BOD) approves** the membership application.
5. Upon approval, the new member must:
   - Pay a minimum **paid-up capital of ₱500.00** (equivalent to 5 shares at ₱100 per share).
   - **Subscribe to at least 20 shares** = ₱2,000.00 in total share capital commitment.

#### Ownership Meetings & General Assembly

| Meeting Type | Schedule | Purpose |
|-------------|----------|---------|
| **Ownership Meeting** | At least once a year (June or July) | Update members on financial operations, activities, issues |
| **Annual General Assembly (AGA)** | Second Saturday of March | Elect officers, adopt reports, approve plans & budget, amend bylaws |
| **Special General Assembly** | As needed | Urgent amendments or critical matters requiring general membership approval |
| **Officers Meeting** | At least twice a year | Reporting and operational updates for BOD, committees, staff, employees |

### 10.2 Loan Business Rules

#### General Principles

1. **Quality and Volume** are management policy priorities.
2. **All loans are goal and purpose-oriented** — the borrower must declare the purpose of the loan.
3. **All loan applicants must undergo Credit Investigation (CI)** and are subject to BOD/Credit Committee approval.
4. **A member can renew their loan only upon full payment** of the previous loan.
5. **All loan applications are evaluated and approved by the Credit Committee.**

#### Loan by Assignment

When a borrower has savings deposits, interest on share capital, dividends, patronage refunds, or collectibles/benefits that can secure the loan:
- These are assigned as collateral to the extent of the loanable amount.
- **In case of delinquency:** The assigned savings deposits, dividends, patronage refunds, and benefits are **automatically held** (not available for withdrawal) and **applied as payment** to the outstanding installment due.

### 10.3 Loan Products — Detailed Rules

#### A. Petty Cash Loan

| Rule | Value |
|------|-------|
| **Eligibility** | Regular members with share capital of at least 10 shares (₱1,000.00) |
| **Maximum Loan Amount** | 75% of the member's own share capital |
| **Additional via Co-Maker** | Additional 75% of co-member's share capital |
| **Interest Rate** | 0% (zero interest) |
| **Service Charge** | 2% of principal |
| **Term** | 1 month only |
| **Penalty for Past Due** | 3% per month of remaining balance |
| **Renewal** | Renewable upon full payment |
| **Processing Fee in App** | 2% of principal (auto-calculated) |

**Step-by-Step: Petty Cash Loan Processing**
1. Verify borrower is a regular member with ≥ 10 shares (₱1,000).
2. Calculate loanable amount: `Loanable = Share Capital × 0.75`.
3. If co-maker is added: `Additional = Co-Maker's Share Capital × 0.75`.
4. Create loan in app: Select **Petty Cash Loan** type.
5. Enter principal (max = 75% of share capital).
6. App auto-sets: 0% interest, 2% service charge, 1-month term, monthly frequency.
7. Submit for Credit Committee approval.

---

#### B. Livelihood / Microfinance Loan

| Rule | Value |
|------|-------|
| **Eligibility** | Self-employed members |
| **Maximum Loan Amount** | ₱5,000.00 (based on CI) |
| **Interest Rate** | 2% per month |
| **Service Charge** | 2% of principal |
| **Term** | 2 months |
| **Payment Mode** | Daily (based on source of income) or as agreed |
| **Penalty for Past Due** | 3% per month of remaining balance |
| **Processing Fee in App** | 2% of principal |

**Step-by-Step: Livelihood Loan Processing**
1. Verify applicant is a self-employed regular member.
2. Conduct Credit Investigation (CI) to determine loanable amount (max ₱5,000).
3. Obtain BOD/Credit Committee approval.
4. Create loan in app: Select **Livelihood Loan** type.
5. Enter principal (max ₱5,000).
6. App auto-sets: 2% monthly interest, 2% service charge, 2-month term.
7. Set frequency to **daily** or as agreed based on borrower's income source.

---

#### C. Salary Loan

| Rule | Value |
|------|-------|
| **Eligibility** | Employed members only |
| **Maximum Loan Amount** | ₱5,000.00 (based on CI) |
| **Interest Rate** | 2% per month |
| **Service Charge** | 2% of principal |
| **Term** | 2 months |
| **Payment Mode** | Every payday |
| **Penalty for Past Due** | 3% per month of remaining balance |
| **Processing Fee in App** | 2% of principal |

**Step-by-Step: Salary Loan Processing**
1. Verify applicant is an employed regular member.
2. Conduct CI; confirm employment status and salary schedule.
3. Determine loanable amount based on CI (max ₱5,000).
4. Obtain Credit Committee approval.
5. Create loan in app: Select **Salary Loan** type.
6. Enter principal (max ₱5,000).
7. App auto-sets: 2% monthly interest, 2% service charge, 2-month term, monthly frequency.
8. Set first payment date to align with borrower's payday schedule.

---

#### D. Emergency Loan

| Rule | Value |
|------|-------|
| **Eligibility** | Members with urgent needs (hospitalization, calamity) |
| **Maximum Loan Amount** | ₱5,000.00 (based on CI) |
| **Collateral Requirement** | Must present collateral worth **at least twice** the loan amount |
| **Interest Rate** | 0% (zero interest) |
| **Service Charge** | 2% of principal |
| **Term** | 1 month |
| **Penalty for Past Due** | 3% per month of remaining balance |
| **Processing Fee in App** | 2% of principal |

**Step-by-Step: Emergency Loan Processing**
1. Verify member's emergency situation (hospitalization receipt, calamity certificate, etc.).
2. Assess collateral — must have a value ≥ 2× the loan amount.
3. Conduct CI; determine loanable amount (max ₱5,000).
4. Obtain Credit Committee approval.
5. Create loan in app: Select **Emergency Loan** type.
6. Enter principal (max ₱5,000).
7. App auto-sets: 0% interest, 2% service charge, 1-month term, monthly frequency.
8. Record collateral details in the borrower's file case.

---

#### E. Standard Micro Loan

| Rule | Value |
|------|-------|
| **Default Rate** | 20% flat (configurable by Admin) |
| **Default Term** | 20 weeks |
| **Default Frequency** | Weekly |
| **Interest Type** | Flat (configurable to Diminishing) |
| **Deposit** | 1% of principal per payment (auto-calculated) |
| **Insurance** | ₱10 per payment for weekly loans (auto-calculated from insurance table) |

---

### 10.4 Penalty Rules

**Rule:** A penalty of **3% per month** of the remaining balance is charged when a loan becomes past due.

**Application in the App:**
- The system flags schedules as `late` when the due date has passed without full payment.
- Penalty records are created under `loan_penalties` and added to the borrower's total outstanding balance.
- Penalties are included in the **Outstanding** KPI displayed on the Admin Dashboard.
- The **PAR (Portfolio at Risk)** calculation includes principals where overdue days > 30.

### 10.5 Savings / Time Deposit Rules

| Rule | Value |
|------|-------|
| **Minimum Maintaining Balance** | ₱100.00 |
| **Interest Rate** | 4% per annum |
| **Interest Computation** | Quarterly, on average monthly balance |
| **Cut-Off Date** | 10th of each month |
| **Deposit Form** | Prescribed deposit slip (duly accomplished) |
| **Withdrawal Form** | Prescribed withdrawal slip, verified by posting clerk |
| **Withdrawal Approval** | Must be approved by Manager / Chairman / Vice Chairman or authorized representative |
| **Withdrawal Restriction** | Cannot withdraw savings if borrower has **past due loans** — savings automatically held and applied to outstanding installments |

### 10.6 Financial Management Rules

#### Cash Disbursements
- Checks must be signed by the **Coop Chairperson** as primary signatory and the **Treasurer** as co-signatory.
- In the Chairperson's absence, the **Vice-Chairperson** assumes.
- Only **two signatures** required on checks.
- Anyone signing must review all supporting documents.
- **No individual may sign a check payable to themselves.**

#### Cash Receipts
- All cash received must use **pre-numbered receipts (OR)**.
- The Treasurer prepares a **Monthly Statement of Cash Receipts and Disbursements**.
- The Bookkeeper prepares **quarterly financial statements**:
  - Statement of Financial Operation
  - Statement of Financial Condition
  - Statement of Cash Flows
  - Statement of Changes in Equity

#### Internal Controls Checklist

1. **Pre-numbered receipts** for all cash transactions.
2. **Checklist / log system** for tracking.
3. **Progress reports** for each activity.
4. **Monthly Cash Balance Reconciliation**.
5. **Clear chain of command** for authorization.
6. **Authorized signature required** on all transactions.
7. **Periodic inspection** of all executed transactions.
8. **Separation of duties**: Approving, processing, recording, reviewing, and custody must be separated.
9. The **Cooperative Cashier must NOT post payments to accounts** (separation of duties).
10. **Physical control**: Safes, locked doors/drawers/filing cabinets for cash and blank checks.
11. **Blank checks and checkbooks** must be locked and controlled.
12. Computer data secured with passwords; financial data in locked cabinets.

### 10.7 Statutory Reserves & Distribution Rules

| Fund | Allocation | Usage |
|------|-----------|-------|
| **Net Surplus for Distribution to Members** | 70% of net income | Split 70% to Interest on Share Capital and 30% to Patronage Refund |
| **General Reserve Fund** | 10% of net income | 100% deposited to bank |
| **Optional Fund** | 7% of net income | Land, building, computerization, promotional activities |
| **Community Development Fund** | 3% of net income | Community projects, outreach programs, solicitation donations |
| **CETF (Education & Training)** | 10% of net income | Mandatory trainings, seminars, coop publications, Coop Month celebration |

**Sharing in Net Surplus:**

| Distribution | Allocation |
|---|---:|
| **Interest on Share Capital** | 70% of net surplus for distribution |
| **Patronage Refund** | 30% of net surplus for distribution |

**Patronage Refund Rule:**
Members who fail to attend the General Assembly (GA) without a valid reason communicated in advance (and approved by the Board) forfeit their patronage refund — it is **plowed back to their Capital Build-Up (CBU)** account.

### 10.8 Borrowing / Financial Assistance Rules

1. All major borrowings must be from **the source of least cost**.
2. Must comply with **previous loan agreements and commitments**.
3. **Borrowings may not exceed the loan limit** set by Board Resolution.
4. The Board, in conjunction with the Manager, reviews the loan limit resolution **annually**.
5. The Manager may request a Board approval to increase the limit if needed.

### 10.9 Donation Policy

1. Donations may be made for charitable organizations and community goodwill.
2. All donations must be supported by a **BOD Resolution** stating the necessity and allocated amount.
3. Donations shall be in the form of **check or in-kind**, in the name of the beneficiary.
4. The beneficiary must **duly acknowledge** the donation with proper documentation.
5. **Donations must not exceed ₱10,000.00 per year.**

### 10.10 Loan Renewal Business Rules

1. A borrower may apply for a **new loan (reloan)** only after **full payment** of the previous loan.
2. If a reloan is being processed while a balance remains, the outstanding balance of the previous loan is **deducted from the new loan's net release**.
3. In the app, the reloan flag is automatically set when an existing active loan is detected for the selected borrower.
4. **Net Amount Released** = New Principal − Previous Loan Outstanding Balance.

### 10.11 Human Resource Rules

#### Hiring Policy
- Employees are selected based on **competence, ability, intellect, and capacity for leadership**.
- Management administers the hiring policy including tracking employment inquiries, applications, initial interviews, and rejections.

#### Termination / Dismissal
- **Gross negligence** is grounds for termination.
- The terminated employee must understand the reasons, communicated calmly with respect maintained.
- Terminations comply with the **Labor Law of the Philippines**.

#### Staff Development
- The BOD Vice-Chairman (as Ex-officio Chairman of the ETC) prepares a **staff development plan** for officers and staff, subject to BOD approval.

#### Compensation & Benefits
- The BOD determines compensation/benefits for coop employees.
- BOD members attending meetings may only reimburse **transportation to/from the meeting venue**; meals and snacks during BOD meetings are provided by the coop.
- The BOD determines honorarium amounts for officers, committee members, and employees.
- Employees receive **year-end bonuses**, subject to availability of funds.

#### Performance Appraisal
- Formal appraisals are conducted **at least annually**.
- Based on position descriptions and performance standards.
- Each officer and employee participates in the appraisal.
- Honorarium/compensation adjustments are recommended based on appraisal results.
- All adjustments must be **approved by Manager/BOD** before becoming effective.
- Areas of unsatisfactory performance are reviewed with the Board; remedial actions are recorded in Board minutes.

---

## 11. FINANCIAL FORMULAS & KPI DEFINITIONS

### 11.1 Loan Calculation Formulas

#### Flat Interest (Standard)

```
Total Interest = Principal × (Rate% / 100) × Term (in months)
Total Amount = Principal + Total Interest
Installment = Total Amount / Number of Payments
```

**Example:**
- Principal: ₱10,000
- Rate: 20% flat
- Term: 20 weeks (≈ 5 months)
- Total Interest: ₱10,000 × 20% = ₱2,000
- Total Amount: ₱12,000
- Installment: ₱12,000 / 20 = **₱600 per week**

#### Diminishing Interest

```
Monthly Rate = Annual Rate / 12
Installment = (Principal × Monthly Rate) / (1 − (1 + Monthly Rate)^−N)
Each period's interest decreases as the principal is paid down.
```

### 11.2 Service Charge Calculation
```
Service Charge = Principal × 2%
```

### 11.3 Penalty Calculation
```
Monthly Penalty = Remaining Balance × 3%
Daily Equivalent = Monthly Penalty / 30
```

### 11.4 KPI Definitions

#### Portfolio at Risk (PAR > 30)
```
PAR>30 = Sum of Outstanding Principal (loans with >30 days overdue)
         ÷ Total Gross Loan Portfolio (GLP)
         × 100
```
**Target:** Below 5% is generally acceptable for microfinance institutions.

#### Operational Self-Sufficiency (OSS)
```
OSS = Total Financial Revenue
      ÷ (Financial Expense + Loan Loss Provision + Operating Expense)
      × 100
```
**Target:** OSS > 100% means the cooperative covers all costs from operations.

#### Collection Efficiency (Collector)
```
Efficiency = Total Collected Today ÷ Total Target Today × 100%
```

#### Cash on Hand
```
Cash on Hand = All Cash Receipts (payments + approved remittances)
             − All Cash Disbursements (loans released + expenses + payroll)
```

#### Weekly Target
```
Weekly Target = Sum of all installment_amount for loans 
                with due dates within the current Mon–Sun week
```

### 11.5 Savings Interest Calculation
```
Annual Rate = 4%
Quarterly Rate = 4% / 4 = 1%
Quarterly Interest = Average Monthly Balance × 1%
Monthly Average = Sum of daily balances ÷ Days in Month
Cut-off: 10th of each month
```

### 11.6 Deposit Calculation (per Loan)

For **weekly-term loans**:
```
Deposit per Payment = Principal × 1% × Number of Payments
```

For **monthly-term loans**:
```
Deposit = Principal × 1%
```

### 11.7 Insurance Calculation (per Loan)

For **weekly-term loans**:
```
Insurance = ₱10 × Number of Payments
```

For **monthly-term loans or other frequencies**:
```
Insurance = ₱0 (no auto-insurance; set manually if applicable)
```
Insurance for institutional products is looked up from the official **APR 2026 Insurance Table** based on principal and term.

---

## 12. OFFLINE-FIRST OPERATIONS

### 12.1 What Happens When You Go Offline

The app is designed to work **fully offline**. When internet connectivity is lost:
1. The **Offline Banner** appears at the top of the screen (red indicator).
2. All operations (recording payments, creating loans, adding borrowers) continue to work normally.
3. All changes are saved to the **local SQLite database** on your device.
4. Data is queued for synchronization when connectivity returns.

### 12.2 What Happens When You Come Back Online

1. The **Sync Status Indicator** changes to 🟡 Syncing.
2. The app automatically runs a bidirectional sync:
   - **Pull**: Downloads any new changes from the server (other users' updates).
   - **Push**: Uploads your local changes to the server.
3. The indicator changes to 🟢 Synced when complete.

### 12.3 Pending Changes Count

A count of local unsynchronized records is displayed in the sync indicator. You can also manually trigger a sync from the **Sync Center** screen (accessible via the sync icon).

### 12.4 Data Safety Guarantees

- **No data is lost** when going offline mid-entry. The local database persists all writes.
- If the app crashes, unsaved form data may be lost — always tap **Save** before navigating away.
- If the app is uninstalled, local data is deleted. The cloud backup remains intact and will be downloaded on next login.

### 12.5 Conflict Resolution

If the same record is edited by two users simultaneously (one online, one offline):
- The **last-write-wins** rule applies.
- The most recent timestamp wins during sync.
- The Admin can review the **Audit Report** to detect and resolve conflicts.

---

## 13. DATA SYNC & CLOUD BACKUP

### 13.1 Sync Architecture

The app uses **WatermelonDB** as the local offline database, which syncs with **Supabase** (PostgreSQL) as the cloud backend.

### 13.2 Manual Sync

To manually trigger a sync:
1. Tap the **Sync Status Indicator** badge on any dashboard.
2. The Sync Center screen opens, showing sync progress, last sync time, and pending change count.
3. Tap **Sync Now** to force a sync.

### 13.3 Automatic Sync

The app triggers automatic sync:
- When the app returns from background to foreground.
- When internet connectivity is detected after being offline.
- On a periodic background interval (when the device supports it).

### 13.4 Data Security

- **Borrower PII** (address, phone number) is **AES-encrypted** on the device before being stored locally.
- All data transmitted to/from Supabase uses **HTTPS encryption**.
- **Row-Level Security (RLS)** policies on Supabase ensure that:
  - Collectors only see their assigned borrowers.
  - Each role only sees data they are authorized to access.
  - Admins have full access.

---

## 14. GLOSSARY

| Term | Definition |
|------|-----------|
| **AGA** | Annual General Assembly |
| **BOD** | Board of Directors |
| **CBU** | Capital Build-Up — the savings fund built up from member deposits |
| **CETF** | Cooperative Education and Training Fund |
| **CI** | Credit Investigation |
| **Collection Sheet** | Daily list of borrowers with payments due, used by field collectors |
| **Credit Committee** | Committee responsible for reviewing and approving loan applications |
| **Daily Log** | End-of-day summary report submitted by collectors |
| **Diminishing Interest** | Interest computed on the declining principal balance each period |
| **Excess Cash Receipt** | Payment received in excess of the scheduled installment |
| **Flat Interest** | Interest computed on the original principal for the full loan term |
| **GLP** | Gross Loan Portfolio — total outstanding principal balance of all active loans |
| **Installment** | One periodic payment of a loan (principal + interest portion) |
| **Maturity Date** | Date on which the final loan installment is due |
| **Net Release** | Actual cash handed to the borrower (Principal − Outstanding Previous Balance for reloans) |
| **Offline-First** | Architecture where the app works without internet; syncs when connectivity is available |
| **OR** | Official Receipt |
| **OSS** | Operational Self-Sufficiency |
| **PAR** | Portfolio at Risk — proportion of the loan portfolio that is at risk of default |
| **Past Due** | A payment that has not been made by its due date |
| **Patronage Refund** | Portion of the cooperative's surplus distributed to members based on their transactions |
| **PMES** | Pre-Membership Education Seminar |
| **Principal** | The original loan amount disbursed to the borrower, excluding interest |
| **Reloan** | A new loan issued to a borrower who already has (or previously had) an active loan |
| **Remittance** | Transfer of collected cash from a collector to the cooperative office |
| **RLS** | Row-Level Security — database access control by user role |
| **SCSCC** | POS Cursor-CCF Savings and Credit Cooperative |
| **Service Charge** | A fee charged on the loan principal (2% for SCSCC cooperative loans) |
| **Share Capital** | Ownership units in the cooperative purchased by members (₱100/share) |
| **SOA** | Statement of Account |
| **Sunlight Mode** | High-contrast UI setting for outdoor field use |
| **Sync** | The process of bidirectionally updating local device data with the cloud server |
| **WatermelonDB** | Offline-first SQLite database library used by the app for local data storage |

---

*End of System User Manual*
*POS Cursor-CCF Savings and Credit Cooperative — Infinity Finance LMS*
*Document Version 1.0 — July 2026*
