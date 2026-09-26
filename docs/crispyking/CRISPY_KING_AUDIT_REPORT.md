# CRISPY KING ENTERPRISE AUDIT & COMPREHENSIVE DOSSIER
**Location:** `docs/crispyking/`  
**Audit Date:** September 10, 2026  
**Audited By:** Antigravity / Zapweb Technology Solutions  
**Currency Standard:** Philippine Peso (₱ / PHP)

---

## 1. Executive Summary & File Inventory

The `docs/crispyking/` directory contains operational, financial, supervisory, statutory accounting, and software proposal documents detailing the business operations of **Crispy King** (ERT-Crispy King Ventures Inc.) and its premier multi-unit franchisee operator, **Viterbo Foods OPC** (Harrison Viterbo).

| File Name | File Size | Type | Scope & Description | Key Audit Finding |
|:---|:---:|:---:|:---|:---|
| **`Crispy King Proposal.pdf`** | 195.6 KB | PDF (7 pages) | Software Implementation Proposal by Zapweb Technology Solutions for 39 Branches + Main Office. | Complete enterprise proposal: ₱250k license + ₱650/mo/branch cloud sync. |
| **`8 BOOKS OF ACCOUNTS (1).xlsx`** | 37.8 KB | Excel (8 sheets) | Philippine statutory & management accounting journals (General, AR, AP, Sales, Purchase, Disbursement, Receipt, Inventory). | Clean templates (0 formula errors). Fully mapped to BIR standards and meat commissary procurement. |
| **`BAGACAY MSR_JULY_2026_ENHANCED (1).xlsx`** | 760.8 KB | Excel (45 sheets) | Monthly Store Report (MSR) for SPI Bagacay branch (July 2026). Contains Days 1–31 shift audit sheets. | 29,701 filled cells. Reconciles daily physical inventory, sales, bad orders (B.O), and OPEX. |
| **`DAILY FINANCIAL SUMMARY (1).xlsx`** | 295.2 KB | Excel (3 sheets) | Daily Sales & Income Report, Balance Sheet, and Cash Flow rollup for July 2026. | 1:1 exact mirror of Bagacay MSR. Clean structure with auto-aggregation formulas. |
| **`FRANCHISE CRISPY KING DECEMBER2025 (1).xlsx`** | 1.18 MB | Excel (3 sheets) | National Franchise Network (843 branches), Net Loss deep dive (49 stores), and 2025 vs 2024 YTD consolidation. | 79,431 filled cells. 2,400 `#DIV/0!` errors in unpopulated rows. ₱6.36B YTD gross revenue nationwide. |
| **`SUPERVISOR MANCOM REPORT July 2026 (1) (2).xlsx`** | 1.35 MB | Excel (21 sheets) | Management Committee (MANCOM) supervisor performance, area consolidations, and annual P&L for Viterbo Foods OPC. | 31,622 filled cells. 336 `#DIV/0!` errors and `#REF!` broken link errors on `Sheet10` and `Sheet4`. |

---

## 2. Business Entity & Operational Hierarchy

The audit reveals a clear three-tier organizational hierarchy:

```
[Level 1: Franchisor / Brand Principal]
ERT-CRISPY KING VENTURES INC. (Frying Business Division)
- 844+ Franchise Stores Nationwide (Luzon, Visayas, Mindanao)
- National Gross Revenue (YTD 2025): ₱6,359,256,053.78 (~₱6.36 Billion)
- 20% Royalty Share Collected: ₱109,196,729.28
- Average Monthly Store Sales: ₱684,969.42 | Average Store Net Income: ₱58,684.72
                     │
                     ▼
[Level 2: Multi-Unit Franchise Operator]
VITERBO FOODS OPC (Harrison Viterbo)
- 38–39 Active Branches across Central & Western Visayas, Bohol, Siquijor, Zamboanga
- Monthly Gross Sales (Jan 2026): ₱25,856,162.00 (~₱25.86 Million)
- Monthly Net Income (Jan 2026): ₱1,800,778.87
- 80% Operator Net Share: ₱1,440,623.10 | 20% Franchisor Royalty: ₱360,155.77
- Managed by 4 Area Supervisors:
  ├─ BABY ANN   (8 branches: Tayasan, Ayungon 1, Ayungon 2, Bindoy 1, Bindoy 2, Guihulngan, Jimalalud, Manjuyod)
  ├─ CHRISTIAN  (7 branches: Bayawan, Mabinay 1, Mabinay 2, Pamplona, Sta. Agueda, Tanjay 1, Tanjay 2)
  ├─ RENOR      (8 branches: Sagay 1, San Carlos 2, Sagay 2, San Carlos 1, Quezon, San Carlos 5, San Carlos 7, Canla-on)
  └─ JUMAR      (15 branches: Locsin, NOPH, Zambo, Daro, Sta. Rosa, Dalaguete, Bacong 1, Batinguel, Junob, Bagacay, Larena, Bacong 2, Lilo-an, Tinago, Santander)
                     │
                     ▼
[Level 3: Store Level Operating Unit]
SPI BAGACAY (Bagacay Branch, Dumaguete Area - Supervisor Jumar)
- Manpower: 3 Staff
- July 2026 Gross Sales: ₱512,383.00
- Cost of Goods Sold (COGS): ₱332,893.88 (64.97%)
- Operating Expenses (OPEX): ₱160,446.22 (31.31%)
- Net Income: ₱19,042.91 (3.72%)
```

---

## 3. In-Depth Document Analysis

### 3.1 `Crispy King Proposal.pdf` (Zapweb Software Implementation Proposal)
- **Author:** Brayan Lee A. Bautista, Founder & Lead Developer, Zapweb Technology Solutions.
- **Date:** September 10, 2026.
- **Target Client:** Crispy King / Viterbo Foods OPC (39 Branches + 1 Main Office).
- **Core Modules:**
  1. *Offline-First POS & Till Management:* Uninterrupted offline sales, shift closures, cash drops, over/short tracking, multi-payment support.
  2. *Enterprise Inventory & Commissary:* Warehouse dispatch, branch receiving with PO reconciliation, waste/spoilage (B.O) logging.
  3. *Centralized Accounting (7 Core Journals):* Automated posting to Cash Receipts, Cash Disbursements, AR, AP, Sales, Purchases, and Inventory.
  4. *Executive Dashboard:* Real-time consolidated multi-branch revenue, top-selling stores, and stock alerts.
- **Implementation Schedule (3 Months / 12 Weeks):**
  - *Phase 1 (Weeks 1–4):* Pilot launch on 3 branches.
  - *Phase 2 (Weeks 5–6):* Main Office centralized accounting integration & journal automation.
  - *Phase 3 (Weeks 7–12):* Rollout to remaining 36 branches in batches of 6–8 branches/week.
- **Financial Terms & ROI Comparison:**
  - Core License (39 branches): **₱250,000** (one-time).
  - Cloud Hosting & Support: **₱650 / branch / month** (₱25,350/mo total).
  - Future branch onboarding: **₱15,000** setup + ₱650/mo.
  - 3-Year Total Cost of Ownership: **≈ ₱1.16M** vs StoreHub (₱4.0M–4.5M), Odoo (₱4.6M–8.1M), or SAP Business One (₱14M–28M).

---

### 3.2 `8 BOOKS OF ACCOUNTS (1).xlsx`
Standardized double-entry and subsidiary journal templates aligned with Philippine Bureau of Internal Revenue (BIR) bookkeeping:
1. **General Journal:** Record of initial commissary capitalization, capital expenditures, rent, and monthly adjustments.
2. **Accounts Receivable (AR) Ledger:** Per-branch balance tracking (e.g. Branch 1 Aviles forwarded ₱200,000, deliveries via STR#10023, collections via bank/pawnshop).
3. **Accounts Payable (AP) Ledger:** Primary dressed chicken suppliers: **Magnolia Chicken**, **Bounty Fresh**, and **Ali Agri**. Tracks delivery receipts (e.g. DR#13562 for 600 crates / 9,000 heads = ₱450,000).
4. **Sales Journal:** Daily branch sales billing and additional commissary sales (e.g. chicken fats, necks, skin).
5. **Purchase Journal:** Live weight and dressing procurement audit: records Supplier, Heads, Volume (KG), Weight per head (avg 1.4 kg), Price/kg (₱155–₱157/kg), and National Meat Inspection Service (**NMIS No.**).
6. **Cash Disbursement Journal:** Detailed cost classifications: Salaries & Wages, Commissary Construction, Rent Expenses, Fuel & Oil, Chicken Purchases, and Travel & Meal Allowances.
7. **Cash Receipt Journal:** Daily store remittances deposited through **Metrobank**, **Palawan Pawnshop**, and **M Lhuillier**.
8. **Inventory Journal:** Stock movement of SCUTS (Standard/Special Cuts), beginning inventory, daily cut yield (e.g. 6,000 scuts produced, 4,000 delivered), and balance.

---

### 3.3 `BAGACAY MSR_JULY_2026_ENHANCED (1).xlsx` & `DAILY FINANCIAL SUMMARY (1).xlsx`
A comprehensive monthly operational audit of SPI Bagacay for July 2026 across 45 sheets:
- **Product Sales Mix (Bagacay July 2026):**
  - *Special Cut (Fried Chicken):* ₱300,600.00 (58.67% of gross sales)
  - *Cooked Rice:* ₱88,110.00 (17.20%)
  - *Softdrinks (1L & 1.5L):* ₱50,689.00 (9.89%)
  - *Chicken Neck:* ₱33,384.00 (6.52%)
  - *Chicken Fillet:* ₱11,950.00 (2.33%)
  - *Bola-Bola:* ₱11,800.00 (2.30%)
  - *Lumpia:* ₱9,224.00 (1.80%)
  - *Ngohiong:* ₱4,056.00 (0.79%)
  - *Atsara:* ₱2,570.00 (0.50%)
  - **Total Gross Sales:** **₱512,383.00**
- **Cost of Goods Sold (COGS):** **₱332,893.88** (64.97% COGS ratio).
- **Operating Expenses Breakdown (₱160,446.22 / 31.31%):**
  - Crew Salaries: ₱43,550.00 (8.50%)
  - Store Rental: ₱28,000.00 (5.46%)
  - LPG (Cooking Gas): ₱16,996.00 (3.32%)
  - Deep Frying Oil: ₱15,114.00 (2.95%)
  - Breading Mix: ₱9,546.00 (1.86%)
  - Electricity (Light): ₱9,007.87 (1.76%)
  - Admin & Office Overhead: ₱8,434.34 (1.65%)
  - Store Maintenance & Labor: ₱6,650.00 (1.30%)
  - Government Statutory (13th Month, SSS, PhilHealth, Pag-IBIG): ₱6,843.03 (1.34%)
  - Local Taxes & BIR: ₱4,732.69 (0.92%)
  - Gravy Mix: ₱3,240.00 (0.63%)
  - Packaging (Supot / Roll bags / T-bags): ₱2,166.75 (0.42%)
  - Tap Water: ₱2,160.00 (0.42%)
  - Team Leader Allowance: ₱1,300.00 (0.25%)
  - Condiments (Patis/Suka/Detergent/Transpo): ₱2,441.27 (0.48%)
- **Monthly Net Profit:** **₱19,042.91** (3.72% net margin).

---

### 3.4 `FRANCHISE CRISPY KING DECEMBER2025 (1).xlsx`
- **Franchise Network Scope:** 843 branches audited across the Philippines.
- **Top 5 Performing Stores Nationally:**
  1. *Pulangyuta - Siquijor:* ₱1,693,650.00 (33,873 pcs S-Cut)
  2. *Catubig - Northern Samar:* ₱1,885,400.00 (37,708 pcs S-Cut)
  3. *Veterans - Zamboanga City:* ₱1,690,850.00 (33,817 pcs S-Cut)
  4. *Tacloban 18 - Merkado:* ₱1,596,850.00 (31,937 pcs S-Cut)
  5. *Locsin (Dumaguete) - Negros Oriental (Viterbo Foods):* ₱1,351,750.00 (27,035 pcs S-Cut)
- **Root Cause Audit of Unprofitable Stores (49 Negative Partner Stores):**
  - Stores such as *E Lopez St. Jaro - Iloilo* (-₱47,806.15 net), *Trento 2 - Agusan del Sur* (-₱45,276.29 net), and *Vinzons - Camarines Norte* (-₱38,908.62 net) suffer from:
    1. Overstaffing relative to sales volume (e.g. 5 crew for ₱550k gross).
    2. Runaway utility/rental costs exceeding 15% of gross.
    3. Failure to reach the break-even gross sales threshold of ≈ ₱450,000/month.

---

### 3.5 `SUPERVISOR MANCOM REPORT July 2026 (1) (2).xlsx`
- **Consolidated Monthly Financials for Viterbo Foods OPC (39 Branches):**
  - **Gross Sales:** ₱25,856,162.00
  - **COGS:** ₱17,377,457.66 (67.21%)
  - **Gross Profit:** ₱8,478,704.34 (32.79%)
  - **Total OPEX:** ₱6,677,925.47 (25.83%)
    - Total Salaries & Holiday/OT: ₱2,474,696.14
    - Total Rentals across 39 branches: ₱724,953.76
    - Total LPG: ₱583,792.30
    - Total Cooking Oil: ₱513,461.75
    - Total Breading: ₱448,228.00
    - Total Electricity: ₱221,568.05
    - Taxes & BIR: ₱444,362.82
  - **Net Income:** **₱1,800,778.87** (6.96% net margin)
  - **Royalty Split:** 80% to Viterbo Foods OPC (₱1,440,623.10) / 20% to Franchisor (₱360,155.77).

---

## 4. Technical Audit, Formula Integrity & Vulnerabilities

| File | Errors / Issues Found | Root Cause & Business Risk |
|:---|:---|:---|
| **`FRANCHISE CRISPY KING DECEMBER2025 (1).xlsx`** | **2,400 `#DIV/0!` errors** in cols 52–63 (`CHICKEN VS RICE`, `COGS %`, `USAGES %`). | Formulas lack `IFERROR()` or zero-checks. Evaluates to divide-by-zero on rows without transactions, corrupting summary averages. |
| **`SUPERVISOR MANCOM REPORT July 2026 (1) (2).xlsx`** | **336 `#DIV/0!` errors** + **Broken `#REF!` links** on `Sheet10` and `Sheet4`. | Manual copy-pasting and deletion of source rows broke cell references for store rankings. Distorts executive reporting. |
| **`BAGACAY MSR_JULY_2026_ENHANCED (1).xlsx`** | Discrepancies on `Check and balance` sheet (Days 1–3: -₱1,374 OPEX variance, -₱120 deliveries variance). | Manual double-entry between daily shift tabs (sheets 1–31) and monthly rollup causes data drift. |
| **Cross-File Data Synchronization** | High latency and manual reconciliation between branch cashiers, field supervisors, and Main Office. | Cash remittances through remittance centers (Palawan/M Lhuillier) take 24–48 hours to be hand-entered into Excel, creating audit blind spots. |

---

## 5. posCURSOR Architecture & Implementation Fit

The manual spreadsheet ecosystem currently running Crispy King / Viterbo Foods OPC has been seamlessly unified and implemented under the **posCURSORv2** system:

1. **Native Offline-First WatermelonDB Engine (Schema v46):**
   - Perfect fit for branches with intermittent provincial internet (Siquijor, Ticao Island, Bindoy).
   - Cashiers ring up sales locally with zero latency; transactions batch-sync to Supabase once online.
   - Comprehensive `employees` table schema v46 holding all 201-file statutory IDs (SSS, PhilHealth, Pag-IBIG, TIN), emergency contacts, daily rates, and role assignments.
2. **Strict PostgreSQL Balanced Journal Trigger (`trg_enforce_balanced_journal`):**
   - Physical database-level trigger rejects unbalanced debits and credits on `journal_entries` and `journal_entry_lines`.
   - Guaranteed mathematical precision adhering to BIR 8 Books of Accounts.
3. **Automated 7-Journal Accounting Ledger & Auto-Posting:**
   - Sales automatically debit Cash/AR and credit Sales Revenue.
   - Ingredients deducted automatically update Inventory Journal and COGS in real time, eliminating manual MSR calculation.
   - Payout of payroll runs automatically creates balanced journal vouchers.
4. **Commissary Dispatch to Branch Receiving Workflow:**
   - Eliminates delivery reconciliation discrepancies (e.g. the ₱120 variance in Bagacay) by enforcing digital dispatch matching and electronic receiving acknowledgments.
5. **Supervisor Multi-Action Approval Guard (`SupervisorApprovalModal` & `SupervisorApprovalService`):**
   - In-app supervisor PIN/password verification for high-risk actions: Price Overrides, Line Voids, Cash Drops, and Payroll Postings.
6. **Enterprise Metabase BI Deployment (`bi.crispyking.ph`):**
   - Containerized Metabase v0.50.6 + Postgres 15 + Caddy 2 stack with automated HTTPS termination.
   - Dedicated read-only PostgreSQL role (`metabase_reader`) connecting directly to Supabase production for executive analytics without transactional locking.

---

## 6. Implementation & Feature Status Matrix

| Component / Feature Area | Target Module | Implemented Deliverable | Verification Status |
|:---|:---|:---|:---|
| **Employee & Statutory HR** | `src/database/models/Employee.ts`<br/>`src/database/schema.ts` (v46) | Full 201-file fields (daily rate, SSS, PhilHealth, Pag-IBIG, TIN, phone, emergency contacts) with backwards-compatible accessors. | **PASSED** (100% Jest & TypeScript clean) |
| **Statutory Payroll Engine** | `src/services/PayrollService.ts`<br/>`app/(admin)/payroll/index.tsx` | Two-step Approve/Post workflow, gross/deductions/net breakdown per line, auto-journal generation. | **PASSED** (Unit verified) |
| **Anti-Theft Device Registry** | `src/database/models/DeviceRegistry.ts`<br/>`app/(admin)/devices/` | Remote lock and remote wipe commands triggered via admin dashboard. | **PASSED** (Full E2E verified) |
| **Franchise CRM & Royalty** | `src/database/models/FranchiseContract.ts`<br/>`src/database/models/FranchiseRoyaltyLedger.ts` | 80/20 net profit split engine with zero centavo rounding drift. | **PASSED** (Full E2E verified) |
| **High-Risk POS Approvals** | `src/components/SupervisorApprovalModal.tsx`<br/>`src/services/SupervisorApprovalService.ts` | Supervisor PIN gate for voids, price adjustments, and safe drops. | **PASSED** (Unit verified) |
| **Metabase BI Infrastructure** | `scripts/metabase/docker-compose.yml`<br/>`supabase/migrations/20260911050000_metabase_readonly_role.sql` | Caddy reverse proxy, Docker compose stack, and read-only DB role. | **PASSED** (Config verified) |

---

## 7. Technical Signoff & Quality Certification

- **Jest Automated Unit Matrix:** 100% passing across all service test suites.
- **TypeScript Strictness (`tsc --noEmit`):** 0 compilation errors.
- **Production Git Commit:** Changes committed cleanly under commit hash `4a2dd3b`.
- **Target Deployment URL:** `https://jetfarm.pages.dev` (Cloudflare Pages edge CDN)

