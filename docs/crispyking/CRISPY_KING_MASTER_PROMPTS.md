# Crispy King — Master Implementation Prompts
## Step-by-Step Autonomous Prompts for AI Coding Sessions

**Target Directory:** `d:\GitHub\posCURSORv2`  
**Base Architecture:** Expo (React Native) + WatermelonDB + Supabase + NativeWind  
**Standard Currency:** Philippine Peso (`PHP` / `₱`), centavo-accurate using `formatPHP()`  
**Strict Directives:**
- Red-Green-Refactor TDD: Write unit tests first before writing business services.
- Never use arbitrary hex colors in NativeWind (`bg-[#...]`). Use standard Tailwind classes (`bg-blue-600`, `text-amber-500`).
- Always specify `placeholderTextColor="#9CA3AF"` and text color classes (`text-gray-900`) on `<TextInput>`.
- Keep the project root directory completely clean.

---

## 🚀 Pre-Flight Command Check
Before starting any prompt, always ensure the environment is healthy:
```bash
npm test -- --bail
npm run lint
```

---

## 📌 MASTER PROMPT 1: Foundation, Deployment Config & QSR Roles

```markdown
You are Antigravity executing PHASE 1 of the Crispy King Enterprise System in `d:\GitHub\posCURSORv2`.
Refer to `docs/crispyking/CRISPY_KING_PRD.md` for requirements.

### OBJECTIVE:
Set up deployment configuration, QSR user roles, branch data scoping helpers, and role layouts.

### TASKS:
1. **Deployment Configuration (`src/config/deployment.ts`):**
   - Define `DeploymentMode` type: `'crispy-king' | 'cooperative'`.
   - Export helper functions: `isCrispyKing()`, `isCooperative()`, `getDeploymentMode()`.
   - Default deployment mode to `'crispy-king'` or read from environment variable `EXPO_PUBLIC_DEPLOYMENT_MODE`.

2. **QSR Roles & Permissions (`src/store/AuthContext.tsx` & `src/database/models/UserProfile.ts`):**
   - Add new roles: `'branch_cashier'`, `'branch_manager'`, `'area_supervisor'`, `'commissary_keeper'`, `'executive'` to the allowed user roles.
   - Maintain backward compatibility with existing roles (`admin`, `main_office`, `collector`, etc.).
   - Support `branch_id` and `area_id` properties on the authenticated user context.

3. **Branch Scoping Service (`src/services/BranchScopeService.ts`):**
   - Write tests first in `src/services/__tests__/BranchScopeService.test.ts`.
   - Methods:
     - `getAccessibleBranchIds(user: UserProfile): Promise<string[]>`
     - `canAccessBranch(user: UserProfile, branchId: string): boolean`
     - `filterByBranchScope<T>(query: Query<T>, user: UserProfile): Query<T>`
     - Scoping rules:
       - `executive` / `admin` / `main_office`: Access to all 39 branches.
       - `area_supervisor`: Access to branches under their assigned supervisor area.
       - `branch_manager` / `branch_cashier`: Strictly scoped to their single `user.branch_id`.

4. **Role Route Shells (`app/(cashier)/_layout.tsx`, `app/(branch-manager)/_layout.tsx`, `app/(area-supervisor)/_layout.tsx`, `app/(executive)/_layout.tsx`):**
   - Create route layouts for the new roles using Expo Router.
   - Add role guard check redirecting unauthorized users.
   - Implement clean NativeWind header and bottom tabs.

### VERIFICATION:
Run:
- `npx jest src/services/__tests__/BranchScopeService.test.ts`
- `npm run lint`
- Ensure 100% green tests before committing.
```

---

## 📌 MASTER PROMPT 2: Touch QSR POS Screen & Cash Register Operations

```markdown
You are Antigravity executing PHASE 2 of the Crispy King Enterprise System in `d:\GitHub\posCURSORv2`.
Refer to `docs/crispyking/CRISPY_KING_PRD.md` and `docs/crispyking/CRISPY_KING_AUDIT_REPORT.md`.

### OBJECTIVE:
Build the high-speed touch screen POS for Crispy King cashiers, including item quick-selection, cart calculation, split payments, cash drops, and shift open/close.

### TASKS:
1. **QSR POS Business Service (`src/services/QSRPosService.ts`):**
   - Write tests in `src/services/__tests__/QSRPosService.test.ts`.
   - Core Methods:
     - `calculateOrderTotals(items, discountType, discountValue)`: Handles regular items, SC/PWD 20% discount (with VAT-exempt computation), and returns `{ grossTotal, discountAmount, vatableSales, vatAmount, vatExemptSales, netPayable }`.
     - `processPayment(orderData, paymentMethods)`: Validates cash tender vs change, handles split tender (e.g. Cash ₱300 + GCash ₱212.50), creates `SalesOrder` and `Payment` records.
     - `autoPostOrderToLedger(salesOrder)`: Integrates with `AutoPostingService` to automatically record Sales Journal (DR Cash/AR, CR Sales Revenue) and Cash Receipts Journal.

2. **Shift Management & Cash Control (`src/services/ShiftCashService.ts`):**
   - Write tests in `src/services/__tests__/ShiftCashService.test.ts`.
   - Methods:
     - `openShift(branchId, cashierId, openingFloat)`: Records initial change fund.
     - `recordCashDrop(branchId, cashierId, amount, reason)`: Records cash drop to safe.
     - `generateXReading(shiftId)`: Non-resetting current shift snapshot (total gross sales, cash on hand, drops, refund count).
     - `closeShiftZReading(shiftId, physicalCashBreakdown)`: Final shift closure. Computes expected cash vs physical count, calculates Over/Short variance, posts reconciliation voucher.

3. **Cashier Touch Screens:**
   - `app/(cashier)/pos.tsx`: High-speed touch layout with:
     - Product Grid: Large touch buttons for S-Cut Chicken (₱50), Rice (₱15), Softdrinks 1L/1.5L, Neck, Fillet, Bola-Bola, Lumpia, Ngohiong, Atsara.
     - Fast quantity keypad (+1, +2, +5, +10 buttons).
     - Live Order Summary sidebar with item removal, discount toggles, and total display in ₱ PHP.
     - Checkout modal with split tender, cash tender presets (₱100, ₱200, ₱500, ₱1,000, exact), change display, and receipt generator.
   - `app/(cashier)/shift-open.tsx`: Opening float input modal.
   - `app/(cashier)/shift-close.tsx`: Z-Reading denominations breakdown calculator (₱1000, ₱500, ₱200, ₱100, ₱50, ₱20, coins) and variance reporting.
   - `app/(cashier)/cash-drop.tsx`: Safe drop slip.

### VERIFICATION:
Run:
- `npx jest src/services/__tests__/QSRPosService.test.ts`
- `npx jest src/services/__tests__/ShiftCashService.test.ts`
- `npm run lint`
```

---

## 📌 MASTER PROMPT 3: Commissary Dispatch, Branch Receiving & Bad Order Tracking

```markdown
You are Antigravity executing PHASE 3 of the Crispy King Enterprise System in `d:\GitHub\posCURSORv2`.
Refer to `docs/crispyking/CRISPY_KING_PRD.md`.

### OBJECTIVE:
Implement the Commissary logistics pipeline: PO Dispatch, In-Transit Tracking, Branch Receiving with Variance Reconciliation, and Bad Order (B.O.) / Spoilage logging.

### TASKS:
1. **Schema & Model Setup:**
   - Add `commissary_dispatches` and `waste_logs` tables in `src/database/schema.ts` (increment schema to version `43`).
   - Create models:
     - `src/database/models/CommissaryDispatch.ts`
     - `src/database/models/WasteLog.ts`
   - Register models in `src/database/index.ts`.

2. **Commissary Dispatch Service (`src/services/CommissaryDispatchService.ts`):**
   - Write tests in `src/services/__tests__/CommissaryDispatchService.test.ts`.
   - Methods:
     - `createDispatch(fromLocation, toBranchId, items, poReference, dispatchedBy)`
     - `markInTransit(dispatchId)`
     - `receiveDispatch(dispatchId, receivedItems, receivedBy)`: Calculates line-item variances between expected vs received stock.
     - `verifyAndPostToInventory(dispatchId, verifiedBy)`: Updates destination branch stock using `StockMovement` (type: `transfer`), posts Inventory Journal double-entry.
     - `disputeDispatch(dispatchId, notes)`: Flags shortage/damage for supervisor investigation.

3. **Waste & Bad Order (B.O.) Service (`src/services/WasteLogService.ts`):**
   - Write tests in `src/services/__tests__/WasteLogService.test.ts`.
   - Methods:
     - `recordWaste(branchId, productId, quantity, uom, reason, unitCost, recordedBy, notes)`
     - Automatically creates `StockMovement` (type: `adjustment`, quantity_out) to deduct physical shelf stock.
     - Automatically triggers `AutoPostingService` to post journal voucher:
       - Debit: 5100 Loss on Spoilage & Bad Orders
       - Credit: 1200 Merchandise Inventory
     - `getBranchWasteSummary(branchId, startDate, endDate)`: Aggregates total spoilage cost and breakdown by reason.

4. **UI Screens:**
   - `app/(commissary)/dispatch/new.tsx`: Commissary dispatch creation with branch selector, item picker, and print dispatch note.
   - `app/(commissary)/dispatch/index.tsx`: Dispatches dashboard (Draft, In-Transit, Completed, Disputed).
   - `app/(branch-manager)/receiving/index.tsx`: List of inbound deliveries awaiting physical count.
   - `app/(branch-manager)/receiving/[id].tsx`: Receiving screen with side-by-side Expected vs Received inputs, discrepancy highlighting, and digital acceptance sign-off.
   - `app/(branch-manager)/waste-log/index.tsx` & `create.tsx`: Branch spoilage logger with reason dropdown and photo attachment support.

### VERIFICATION:
Run:
- `npx jest src/services/__tests__/CommissaryDispatchService.test.ts`
- `npx jest src/services/__tests__/WasteLogService.test.ts`
- `npm run lint`
```

---

## 📌 MASTER PROMPT 4: Digital MSR, 80/20 Royalty Split & Executive Dashboards

```markdown
You are Antigravity executing PHASE 4 of the Crispy King Enterprise System in `d:\GitHub\posCURSORv2`.
Refer to `docs/crispyking/CRISPY_KING_PRD.md`, `docs/crispyking/BAGACAY MSR_JULY_2026_ENHANCED (1).xlsx`, and `docs/crispyking/SUPERVISOR MANCOM REPORT July 2026 (1) (2).xlsx`.

### OBJECTIVE:
Automate the 31-day Monthly Store Report (MSR), compute the 80/20 Franchisor Royalty splits, and build consolidated dashboards for Main Office Executives and the 4 Area Supervisors.

### TASKS:
1. **Digital MSR Engine (`src/services/MSRService.ts`):**
   - Write tests in `src/services/__tests__/MSRService.test.ts`.
   - Validate against the SPI Bagacay July 2026 ground truth:
     - Gross Sales: ₱512,383.00
     - COGS: ₱332,893.88 (64.97%)
     - OPEX: ₱160,446.22 (31.31%)
     - Net Income: ₱19,042.91 (3.72%)
   - Methods:
     - `generateDailyMSR(branchId, date)`: Aggregates item sales mix, direct cost of goods, OPEX vouchers, bad orders, and cash remittances.
     - `generateMonthlyStoreReport(branchId, year, month)`: Returns complete 31-day store rollup, COGS ratio, food cost variance, and ending inventory balance.
     - `exportMSRToCSV(branchId, year, month)`: Generates clean, audit-ready CSV/XLSX export without formula errors.

2. **Franchise Royalty Calculator (`src/services/RoyaltyService.ts`):**
   - Write tests in `src/services/__tests__/RoyaltyService.test.ts`.
   - Model `RoyaltyCalculation` in schema v43.
   - Methods:
     - `calculateMonthlyRoyalty(branchId, year, month)`: Computes Gross Sales - COGS - OPEX = Net Income; Operator Share (80%) and Franchisor Share (20%), rounding to 2 decimal PHP.
     - `calculateAllBranchesRoyalty(year, month)`: Batch computation for all 39 stores.
     - `approveRoyaltySettlement(royaltyId, approverId)`: Generates AP voucher to ERT-Crispy King Ventures Inc. for the 20% royalty share.

3. **Executive & Supervisor Dashboards:**
   - `app/(executive)/dashboard.tsx`:
     - 39-Branch Gross Revenue Real-Time Rollup.
     - Store Leaderboard: Top 5 and Bottom 5 performing branches ranked by Sales & Net Margin.
     - Total Chicken Heads/Pieces Sold Counter.
     - Network Food Cost Gauge (Target ≤ 65%).
     - Area Breakdown cards for the 4 supervisors (Baby Ann, Christian, Renor, Jumar).
     - Low Stock & Delivery Variance Alerts.
   - `app/(area-supervisor)/dashboard.tsx`:
     - Scoped strictly to the supervisor's 7–16 assigned stores.
     - Store-by-store sales target vs actual.
     - Branch Spoilage % Leaderboard.
     - Unverified Deliveries and Remittance Approvals.

### VERIFICATION:
Run:
- `npx jest src/services/__tests__/MSRService.test.ts`
- `npx jest src/services/__tests__/RoyaltyService.test.ts`
- `npm test`
- `npm run lint`
```

---

## 📌 MASTER PROMPT 5: Seeding 39 Branches, QSR Catalog, Migration & Partitioned Sync

```markdown
You are Antigravity executing PHASE 5 of the Crispy King Enterprise System in `d:\GitHub\posCURSORv2`.
Refer to `docs/crispyking/CRISPY_KING_PRD.md` and `docs/crispyking/CRISPY_KING_AUDIT_REPORT.md`.

### OBJECTIVE:
Seed master Crispy King data (39 branches across 4 supervisors, full product catalog, suppliers, and QSR chart of accounts), deploy Supabase migrations, and implement branch-partitioned sync.

### TASKS:
1. **Master Seed Script (`scripts/seed-crispy-king.ts`):**
   - **4 Area Supervisors & 39 Branches:**
     - Area Baby Ann (8 stores): Tayasan, Ayungon 1, Ayungon 2, Bindoy 1, Bindoy 2, Guihulngan, Jimalalud, Manjuyod.
     - Area Christian (7 stores): Bayawan, Mabinay 1, Mabinay 2, Pamplona, Sta. Agueda, Tanjay 1, Tanjay 2.
     - Area Renor (8 stores): Sagay 1, San Carlos 2, Sagay 2, San Carlos 1, Quezon, San Carlos 5, San Carlos 7, Canla-on.
     - Area Jumar (16 stores): Locsin, NOPH, Zambo, Daro, Sta. Rosa, Dalaguete, Bacong 1, Batinguel, Junob, Bagacay, Larena, Bacong 2, Lilo-an, Tinago, Santander, Dumaguete Port.
   - **Master Products (10 items):**
     - Special Cut Fried Chicken (₱50), Rice (₱15), Neck (₱20), Fillet (₱45), Bola-Bola (₱20), Lumpia (₱15), Ngohiong (₱20), Atsara (₱10), Softdrinks 1.0L (₱45), Softdrinks 1.5L (₱65).
   - **Master Suppliers:**
     - Magnolia Chicken, Bounty Fresh, Ali Agri (Live/Dressed Broilers).
   - **QSR Chart of Accounts:**
     - Assets: 1010 Cash on Hand, 1020 Petty Cash, 1100 Accounts Receivable, 1200 Merchandise Inventory (Raw Chicken, Fried Chicken, Rice, Oil, Breading, Drinks).
     - Liabilities: 2010 Accounts Payable (Suppliers), 2050 Due to Franchisor (Royalty Payable).
     - Equity: 3010 Partner Capital (Viterbo Foods OPC).
     - Revenue: 4010 Fried Chicken Sales, 4020 Rice Sales, 4030 Beverage Sales, 4040 Specialty Sales, 4050 By-Product Sales (Fats/Skin).
     - COGS: 5010 Dressed Chicken Used, 5020 Deep Frying Oil, 5030 Breading & Gravy Mix, 5040 Raw Rice, 5050 Beverage Inventory Used.
     - OPEX: 5100 Spoilage & Bad Orders, 6010 Crew Salaries & Wages, 6020 Store Rent, 6030 LPG Cooking Gas, 6040 Electricity, 6050 Tap Water, 6060 Packaging & Paper Bags, 6070 Local Taxes & BIR, 6080 Team Leader Allowance, 6090 Repair & Maintenance.

2. **Supabase Schema Migrations:**
   - Create `supabase/migrations/20260910_crispy_king_core.sql` defining:
     - `commissary_dispatches` table & RLS.
     - `waste_logs` table & RLS.
     - `production_batches` table & RLS.
     - `royalty_calculations` table & RLS.
     - Update `branches` table with `area_supervisor_id` and `area_name`.

3. **Partitioned Sync Filter (`src/services/SyncService.ts`):**
   - Add branch-level filtering for device sync to prevent provincial branch devices from pulling transactions of the other 38 branches:
     - Cashier / Manager devices sync UP their local sales/expenses, and only pull DOWN their branch's inventory movements and global master products/prices.
     - Executive / Supervisor devices pull consolidated data.

### VERIFICATION:
Run:
- `npm test`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run export:web`
```

---

## 📌 MASTER PROMPT 6: Final End-to-End Verification & Zero-Defect Release

```markdown
You are Antigravity executing the FINAL VERIFICATION of the Crispy King Enterprise System in `d:\GitHub\posCURSORv2`.

### OBJECTIVE:
Run the end-to-end multi-branch test matrix, verify all business logic edge cases, test offline-sync convergence, and ensure 100% test pass rate.

### VERIFICATION CHECKLIST:
1. **Full Test Matrix Execution:**
   - `npm test` — Ensure all unit tests (target: 1,400+ tests) pass without a single failure.
   - `npm run lint` — Zero ESLint errors or warnings.
   - `npx tsc --noEmit` — Zero TypeScript compilation errors.
   - `npm run export:web` — Production web export bundle succeeds cleanly.

2. **Critical Flow Verifications:**
   - [ ] Cashier rings up S-Cut + Rice + Drink: Orders save locally, cash drawer triggers, and `AutoPostingService` posts balanced debits/credits.
   - [ ] Split tender with GCash and Cash correctly calculates exact change and creates split payment records.
   - [ ] Safe cash drop correctly updates running drawer balance and warns when till limit is exceeded.
   - [ ] Z-Reading calculates physical cash over/short variance correctly.
   - [ ] Commissary dispatch posts stock from commissary to branch upon digital verification with variance reconciliation.
   - [ ] Waste/B.O. entry immediately deducts branch stock balance and debits Spoilage Expense (5100).
   - [ ] Monthly MSR numbers match Bagacay July 2026 reference benchmarks.
   - [ ] Royalty calculations split 80/20 with zero rounding drift.
   - [ ] Branch data isolation strictly prevents cashier at Branch A from seeing sales of Branch B.

Report final verification results in detail.
```
