# Crispy King Enterprise POS, Inventory & Accounting System
## Comprehensive Product Requirements Document (PRD)

**Project:** Crispy King Enterprise System (posCURSOR v2)  
**Client / Franchisee:** Viterbo Foods OPC (Harrison Viterbo) & ERT-Crispy King Ventures Inc.  
**Audited Target Scope:** 39 Operational Branches + 1 Main Office Commissary  
**Monetary Standard:** Strictly Philippine Peso (₱ / PHP), centavo-accurate  
**Architecture Base:** Offline-First Expo (React Native) + WatermelonDB (v42 Schema, 60 Tables) + Supabase Cloud Sync + NativeWind  
**Reference Documents:** 
- `docs/crispyking/Crispy King Proposal.pdf` (Zapweb Technology Solutions Proposal by Brayan Lee A. Bautista)
- `docs/crispyking/CRISPY_KING_AUDIT_REPORT.md`
- `docs/crispyking/BAGACAY MSR_JULY_2026_ENHANCED (1).xlsx` (Store-level MSR reference)
- `docs/crispyking/SUPERVISOR MANCOM REPORT July 2026 (1) (2).xlsx` (Area supervision & P&L)
- `docs/crispyking/FRANCHISE CRISPY KING DECEMBER2025 (1).xlsx` (843 nationwide stores)
- `docs/crispyking/8 BOOKS OF ACCOUNTS (1).xlsx` (BIR 7-Journal statutory templates)

---

## 1. Executive Summary & Problem Statement

### 1.1 Current Operational Pain Points
1. **Manual Spreadsheet Fragmentation:** Crispy King's 39 branches rely on manual 45-sheet Excel Monthly Store Reports (MSRs) with 2,400+ formula errors (`#DIV/0!`, broken `#REF!` links), manual copying of shift tabs, and cross-sheet reconciliation variance (e.g. Bagacay Day 1–3 discrepancy of -₱1,374 OPEX).
2. **Intermittent Provincial Connectivity:** Branches in remote Visayas/Mindanao locations (Siquijor, Ticao Island, Bindoy, Ayungon) suffer frequent internet outages. Cloud-only SaaS (e.g., StoreHub, Odoo) stalls the counter.
3. **Commissary-to-Branch Delivery Leakage:** Hand-written delivery receipts (DRs) between Main Office commissary and branches lead to stock reconciliation disputes, unrecorded bad orders, and shrinkage.
4. **Delayed Financial Visibility:** Daily sales remittances sent via remittance centers (Metrobank, Palawan Pawnshop, M Lhuillier) take 24–48 hours to be hand-entered, blinding executives to underperforming branches.
5. **High Food Cost / Thin Margins:** Typical store COGS is high (~65–67%) on fried chicken, cooking oil, LPG, and breading. Without real-time tracking of bad orders (B.O.) and frying oil consumption, net margins easily dip negative.

### 1.2 The Solution
Deploy the **posCURSOR v2** enterprise platform tailored for Crispy King:
- **Offline-First Touch POS:** Fast cashiering on Android tablets/desktops; transactions ring up instantaneously with zero network lag and auto-queue for background sync.
- **Digital Commissary & Dispatch-Receiving:** Enforced digital PO matching (Dispatched → In-Transit → Received → Verified → Posted to Inventory).
- **Automated 7 Core BIR Journals:** Zero manual bookkeeping. POS tickets, cash disbursements, supplier invoices, and stock adjustments automatically post balanced double-entry vouchers to General Ledger.
- **Automated Digital MSR:** Replaces the 45-sheet Excel file with real-time daily product sales mix, itemized OPEX, bad order logging, and inventory reconciliation.
- **Consolidated Executive & Area Supervisor Dashboards:** Live ranking of all 39 stores across the 4 supervisors (Baby Ann, Christian, Renor, Jumar), alerting management to low stock, COGS anomalies, and branch remittance health.

---

## 2. Business Entity & Organizational Hierarchy

```
ERT-CRISPY KING VENTURES INC. (Franchisor Principal)
  └─ 844+ Franchise Stores Nationwide (~₱6.36B Annual Gross)
  └─ 20% Royalty Share
        │
        ▼
VITERBO FOODS OPC (Harrison Viterbo - Multi-Unit Franchisee Operator)
  └─ 39 Branches (Dumaguete, Negros Oriental, Bohol, Siquijor, Zamboanga)
  └─ Monthly Gross: ~₱25.86M | Net Income: ~₱1.80M | Operator Share: 80%
  └─ Main Office Commissary & Central Warehouse
        │
        ├── Area 1: BABY ANN (8 Branches)
        │     ├─ Tayasan, Ayungon 1, Ayungon 2, Bindoy 1, Bindoy 2, Guihulngan, Jimalalud, Manjuyod
        │
        ├── Area 2: CHRISTIAN (7 Branches)
        │     ├─ Bayawan, Mabinay 1, Mabinay 2, Pamplona, Sta. Agueda, Tanjay 1, Tanjay 2
        │
        ├── Area 3: RENOR (8 Branches)
        │     ├─ Sagay 1, San Carlos 2, Sagay 2, San Carlos 1, Quezon, San Carlos 5, San Carlos 7, Canla-on
        │
        └── Area 4: JUMAR (16 Branches)
              ├─ Locsin, NOPH, Zambo, Daro, Sta. Rosa, Dalaguete, Bacong 1, Batinguel,
              ├─ Junob, Bagacay, Larena, Bacong 2, Lilo-an, Tinago, Santander, Dumaguete Port
```

---

## 3. Existing vs Required System Architecture Gap Analysis

| Functional Domain | Existing posCURSOR Engine (Schema v42, 60 Tables, 72 Services) | Gaps to Implement for Crispy King |
|:---|:---|:---|
| **POS & Cashiering** | `MarketplaceOrderService`, `CashService` (522 lines), `CashTransaction`, petty cash ledger, reconciliation. | **Touch QSR POS Screen:** Touch menu grid (S-Cut Chicken, Rice, Drinks, Lumpia, Ngohiong), cashier shift open float, X-reading, Z-reading, safe drops, split-tender (Cash + GCash/Maya), PWD/Senior 20% discount. |
| **Accounting & 7 Core Journals** | **100% Fully Built:** `CashReceiptsJournalService`, `CashDisbursementsJournalService`, `SalesJournalService`, `PurchaseJournalService`, `InventoryJournalService`, `AccountsReceivableLedgerService`, `AccountsPayableService`, `AutoPostingService` (1,084 lines), `ConsolidationService`, `FinancialStatementService`. | **Branch Scoping & QSR COA:** Add `branch_id` filtering across journals, seed Crispy King standard QSR Chart of Accounts (Dressed Chicken, Cooking Oil, LPG, Breading, Gravy, Packaging, Franchisor Royalty). |
| **Inventory & Commissary** | `StockMovement` (audit ledger with WAC, in/out/balance), `Supplier`, `AccountsPayableVoucher`. | **Commissary Pipeline:** (1) Digital Dispatch-to-Branch Receiving workflow, (2) Bad Order (B.O.) / Spoilage Logger with auto-inventory deduction, (3) Commissary Recipe Yield / BOM for live weight dressing to SCUTS. |
| **Multi-Tenant RBAC** | `UserProfile`, `RolePermission`, `FeatureFlag`, `ActionLogService`. Roles: admin, main_office, collector, encoders. | **QSR Roles & Data Scoping:** Add `branch_cashier`, `branch_manager`, `area_supervisor`, `commissary_keeper`, `executive`. Enforce strict branch data isolation. |
| **Franchise Financials** | `DailySummaryService`, `ConsolidationService`, reports engine. | **80/20 Royalty Split Automation & Digital MSR:** Monthly 80/20 franchisor split calculations and automated generation of the 31-day store performance report. |
| **Sync & Resilience** | `SyncService` (1,364 lines) WatermelonDB ↔ Supabase with retry and table contracts. | **Partitioned Sync:** Add branch-level pull filter so provincial branch devices only sync their assigned branch's transactions and master product data. |

---

## 4. Product Catalog & Pricing Architecture

### 4.1 Master Products & Standard Units
| Item Code | Description | Category | Standard Unit | Retail Price (PHP) | Recipe / BOM Component |
|:---|:---|:---|:---:|:---:|:---|
| `CK-SCUT` | Special Cut (S-Cut) Fried Chicken | Hot Food | Piece (pc) | ₱50.00 | Dressed Chicken (SCUT yield), Breading Mix, Frying Oil |
| `CK-RICE` | Cooked Rice | Hot Food | Serving | ₱15.00 | Raw Rice, Water |
| `CK-NECK` | Chicken Neck | Hot Food | Piece (pc) | ₱20.00 | Chicken Neck, Breading, Frying Oil |
| `CK-FLT` | Chicken Fillet | Hot Food | Piece (pc) | ₱45.00 | Chicken Breast Fillet, Breading, Oil |
| `CK-BOLA` | Bola-Bola | Specialty | Piece (pc) | ₱20.00 | Ground Meat, Seasoning, Oil |
| `CK-LUMP` | Lumpia | Specialty | Piece (pc) | ₱15.00 | Spring Roll Wrapper, Meat Mix, Oil |
| `CK-NGOH` | Ngohiong | Specialty | Piece (pc) | ₱20.00 | Ubod/Meat Seasoned Roll, Batter, Oil |
| `CK-ATSR` | Atsara | Condiment | Cup (cup) | ₱10.00 | Pickled Papaya Mix |
| `CK-SD10` | Softdrinks 1.0L (Coke/Sprite/Royal) | Beverage | Bottle (btl) | ₱45.00 | Finished Beverage |
| `CK-SD15` | Softdrinks 1.5L (Coke/Sprite/Royal) | Beverage | Bottle (btl) | ₱65.00 | Finished Beverage |

### 4.2 Commissary Procurement & Raw Materials
| Supplier | Raw Material | UOM | Standard Cost (PHP) | Tracking Requirement |
|:---|:---|:---:|:---:|:---|
| Magnolia Chicken / Bounty Fresh / Ali Agri | Live Dressed Broiler Chickens | KG / Head | ₱155.00–₱157.00/kg (Avg 1.4 kg/hd) | NMIS Certificate #, Crate Count, Live Weight |
| Central Commissary | Breading Mix | Bag (25kg) | ₱1,150.00/bag | Batch Expiry, In-Store Usage Rate |
| Central Commissary | Deep Frying Oil | Tin / Pail (17L) | ₱1,250.00/tin | Usage per SCUT batch |
| Central Commissary | Gravy Powder Mix | Pack (1kg) | ₱120.00/pack | Yield ratio |
| Local Supplier | Solane / Petron LPG Gas | Tank (50kg) | ₱3,800.00/tank | Tank replacement cycle |
| Packaging Supplier | Supot, T-Bag, Roll Bags | Bundle | ₱180.00/bundle | Unit usage per order |

---

## 5. Functional Specifications & Workflows

### 5.1 QSR Touch POS & Cash Management (`app/(cashier)/`)
1. **Shift Initialization (Opening Float):**
   - Cashier enters opening register cash (e.g. ₱2,000.00 change fund).
   - System locks POS terminal until opening float is committed and recorded in `CashTransaction`.
2. **High-Speed Touch Checkout:**
   - Large touch grid optimized for 8"–11" tablets and desktop touchscreen monitors.
   - 1-tap item addition with fast multiplier (+ / - / quantity keypad).
   - Real-time cart calculation displaying Net Total, VAT (if applicable), and Discounts.
3. **Discounts & Exemptions:**
   - SC/PWD 20% discount with customer ID input, automatically computing VAT exemption.
4. **Split-Tender & Multi-Payment Processing:**
   - Cash: Built-in change calculator with tender presets (₱100, ₱200, ₱500, ₱1,000, Exact).
   - E-Wallet: Digital reference capture for GCash / Maya payments.
   - Charge / Wholesale Account: Scoped for authorized institutional bulk orders.
5. **Mid-Shift Cash Drops:**
   - Enforce cash drops when till balance exceeds predefined threshold (e.g. ₱10,000) to secure cash in branch safe.
6. **X-Reading & Z-Reading Shift Closure:**
   - **X-Reading:** Interim non-resetting sales summary printable at any point during shift.
   - **Z-Reading:** End-of-day final shift closure. Cashier inputs physical cash count breakdown (₱1,000, ₱500, ₱200, ₱100, ₱50, ₱20, coins).
   - System calculates Over / Short variance, creates shift journal voucher, and locks the shift register.

### 5.2 Commissary Dispatch & Branch Receiving (`app/(commissary)/` & `app/(branch-manager)/`)
1. **PO Dispatch Generation:**
   - Commissary creates dispatch batch specifying destination branch, PO reference, vehicle/driver info, dispatched quantities (e.g. 500 pcs S-Cut, 10 pails Oil, 5 bags Breading).
   - Status transitions to `in_transit`. Stock is moved to In-Transit Holding ledger.
2. **Branch Receiving & Digital Acknowledgment:**
   - Branch tablet notifies manager of incoming transfer.
   - Manager counts physical delivery and logs received quantities.
3. **Variance & Discrepancy Reconciliation:**
   - If `received_qty == expected_qty`: Status becomes `verified`, stock automatically posts to Branch Inventory (`StockMovement` type: `transfer`).
   - If `received_qty != expected_qty`: Manager inputs variance reason (spoilage in transit, short delivery, damaged packaging). System flags transaction for supervisor review while posting actual received stock to inventory.

### 5.3 Bad Order (B.O.) / Spoilage Logger
1. **In-Store Spoilage Recording:**
   - Cashier or Manager logs spoiled or damaged items (overcooked chicken, dropped pieces, expired atsara, broken softdrink bottles).
   - Captures quantity, reason (`spoilage`, `bad_order`, `overcooked`, `expired`, `damage`), and shift date.
2. **Automatic Accounting & Stock Deduction:**
   - Automatically posts `StockMovement` (type: `adjustment`, quantity_out).
   - Auto-posts double entry to General Ledger:
     - **Debit:** Account `5100` (Loss on Spoilage & Bad Orders)
     - **Credit:** Account `1200` (Branch Merchandise Inventory)

### 5.4 Automated 7 Core BIR Journals Integration
Every transaction automatically generates balanced, double-entry journal vouchers through the existing `AutoPostingService`:
1. **Sales Journal (SJ):** Every POS transaction auto-posts (DR Cash / AR, CR Sales Revenue per product category).
2. **Cash Receipts Journal (CRJ):** Daily retail collections, change fund remittances, and settled receivables.
3. **Cash Disbursements Journal (CDJ):** Petty cash payouts, local store expenses (ice, tap water, emergency crew meals).
4. **Purchase Journal (PJ):** Deliveries received from commissary or direct supplier invoices (DR Inventory, CR Accounts Payable).
5. **Inventory Journal (IJ):** Real-time tracking of Beginning Stock + Deliveries - Sales - Bad Orders = Ending Balance via Weighted Average Cost.
6. **Accounts Receivable (AR) Ledger:** Institutional bulk sales and wholesale by-product sales (chicken skin, fats).
7. **Accounts Payable (AP) Ledger:** Commissary payables to Magnolia Chicken, Bounty Fresh, Ali Agri with aging brackets (1–30, 31–60, 61–90, 90+ days).

### 5.5 Digital Monthly Store Report (MSR) Automation
Replaces the manual Excel MSR with automated real-time aggregation:
- **Daily Shift Consolidation:** 31-day store rollup matching the Bagacay reference model.
- **Product Sales Mix Matrix:** Units and gross sales for all 10 standard items.
- **OPEX Breakdown:** Automated categorization into Crew Salaries, Rent, LPG, Cooking Oil, Breading, Electricity, Water, Packaging, Taxes, and Team Leader Allowances.
- **KPI Dashboards:** Food Cost % (COGS vs 65% target), Gross Profit, Operating Expenses %, and Store Net Income.

### 5.6 Franchise Royalty Calculation (80/20 Split)
- Formula: 
  $$\text{Net Income} = \text{Gross Sales} - \text{COGS} - \text{OPEX}$$
- Operator Share: 
  $$\text{Viterbo Foods OPC Share} = \text{Net Income} \times 80\%$$
- Franchisor Share: 
  $$\text{ERT-Crispy King Royalty} = \text{Net Income} \times 20\%$$
- Generates monthly settlement vouchers ready for disbursement and bank transfer recording.

---

## 6. Technical Specifications & New Schemas

### 6.1 Database Schema Additions (Incrementing from v42 to v43)
New tables to register in `src/database/schema.ts` and `src/database/models/`:

1. **`commissary_dispatches` Table:**
   - `id`: string (UUID v4)
   - `dispatch_number`: string (indexed)
   - `from_location`: string
   - `to_branch_id`: string (indexed)
   - `status`: string (`draft`, `dispatched`, `in_transit`, `received`, `verified`, `disputed`)
   - `dispatched_by`: string
   - `dispatched_at`: number (timestamp)
   - `received_by`: string (optional)
   - `received_at`: number (optional)
   - `verified_by`: string (optional)
   - `verified_at`: number (optional)
   - `items_json`: string (serialized JSON array of items, expected vs received)
   - `variance_notes`: string (optional)
   - `created_at`, `updated_at`, `deleted_at`

2. **`waste_logs` Table:**
   - `id`: string (UUID v4)
   - `branch_id`: string (indexed)
   - `product_id`: string (indexed)
   - `quantity`: number
   - `uom`: string
   - `reason`: string (`spoilage`, `bad_order`, `overcooked`, `expired`, `damaged`)
   - `unit_cost`: number
   - `total_cost`: number
   - `shift_date`: string
   - `recorded_by`: string
   - `notes`: string (optional)
   - `stock_movement_id`: string (optional)
   - `created_at`, `updated_at`, `deleted_at`

3. **`production_batches` Table:**
   - `id`: string (UUID v4)
   - `batch_number`: string (indexed)
   - `batch_date`: string
   - `supplier_id`: string (indexed)
   - `nmis_number`: string
   - `raw_product_id`: string
   - `raw_heads_count`: number
   - `raw_weight_kg`: number
   - `price_per_kg`: number
   - `total_raw_cost`: number
   - `yield_items_json`: string (JSON array of output cuts produced)
   - `total_yield_kg`: number
   - `yield_percentage`: number
   - `waste_kg`: number
   - `created_by`: string
   - `created_at`, `updated_at`, `deleted_at`

4. **`royalty_calculations` Table:**
   - `id`: string (UUID v4)
   - `branch_id`: string (indexed)
   - `period_year`: number
   - `period_month`: number
   - `gross_sales`: number
   - `cogs_amount`: number
   - `opex_amount`: number
   - `net_income`: number
   - `operator_share_pct`: number (default 80.0)
   - `franchisor_share_pct`: number (default 20.0)
   - `operator_amount`: number
   - `franchisor_amount`: number
   - `status`: string (`draft`, `approved`, `remitted`)
   - `approved_by`: string (optional)
   - `created_at`, `updated_at`, `deleted_at`

---

## 7. Implementation Roadmap & Milestones

```
Phase 1: Foundation, QSR Touch POS & Branch Scoping (Weeks 1–3)
Phase 2: Commissary Logistics, Bad Orders & Yield BOM (Weeks 4–6)
Phase 3: Executive Dashboards, Digital MSR & Royalty Automation (Weeks 7–8)
Phase 4: Seeding 39 Branches, Partitioned Sync & Full Verification (Weeks 9–10)
```

This PRD provides the single source of truth for the entire software engineering and deployment lifecycle of the Crispy King Enterprise System.
