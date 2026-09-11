# Loan and Payment Computation Audit

Date: 2026-04-21  
Scope: Read-only review of loan computations, payment workflows, loan-payment relationships, schedules, balances, renewal behavior, cash attribution, and KPI/reporting logic.

No code or database schema changes were made as part of this audit.

## Executive Summary

The base loan math in `LoanCalculatorService` is covered by tests and the focused calculator test suite passed. The largest risks are not in the simple loan-total formula itself; they are in the workflow around payment recording and downstream schedule, status, cash, and KPI updates.

Key concerns:

1. Payment records are connected to loans through `loan_id`, but almost never connected to individual schedules through `schedule_id`.
2. The payment encoder screen records payments but does not update schedules or loan status.
3. Partial payment allocation is not cumulative, so partially paid schedules may never become fully paid.
4. Admin payment flow may over-create borrower savings deposits.
5. Renewal closure only runs when `deductedAmount > 0`, leaving some renewed old loans active.
6. KPI/PAR/reporting logic mixes principal-only and total-receivable concepts.
7. Actual local data already contains paid loans with remaining balances, overpayments, duplicate active loans, renewal inconsistencies, and schedule mismatches.

## Files Reviewed

Primary computation and workflow files:

- `src/services/LoanCalculatorService.ts`
- `src/services/LoanService.ts`
- `app/(loan-encoder)/index.tsx`
- `app/(admin)/loans/new.tsx`
- `app/(admin)/payments/new.tsx`
- `app/(payment-encoder)/index.tsx`
- `src/services/BorrowerPortalService.ts`
- `src/services/KpiCalculator.ts`
- `src/services/MfiKpiService.ts`
- `src/services/CashService.ts`
- `src/services/AuditService.ts`
- `src/services/SyncService.ts`
- `src/database/schema.ts`
- `src/database/models/Loan.ts`
- `src/database/models/Payment.ts`
- `src/database/models/PaymentSchedule.ts`

## Data Model Relationship

Core relationships:

```text
loans.id -> payments.loan_id
loans.id -> payment_schedules.loan_id
payment_schedules.id -> payments.schedule_id
```

In practice, only `loan_id` is consistently used. `payments.schedule_id` exists in the schema/model but is effectively unused.

Most balance computations use either:

```ts
loan.totalAmount - sum(payments.amount)
```

or, where penalties are included:

```ts
loan.totalAmount + penaltyTotal - sum(payments.amount)
```

## Verification Performed

Focused calculator tests:

```powershell
npm.cmd test -- --runInBand src/services/__tests__/LoanCalculatorService.test.ts
```

Result:

```text
PASS src/services/__tests__/LoanCalculatorService.test.ts
Tests: 19 passed, 19 total
```

A broader service test command including `LoanService` timed out, so it was not counted as passing.

A read-only local DB consistency scan was also performed against the local Supabase database.

## Local Data Consistency Snapshot

Read-only scan results:

```text
loans:     569
payments:  13,170
schedules: 22,691
```

Detected issues:

```text
schedule_total_mismatches:              6
paid_status_with_balance:              270
active_status_fully_paid:                0
overpaid_loans:                          2
orphan_payments:                         0
orphan_schedules:                        0
borrowers_with_multiple_active_loans:    3
renewals_old_loan_not_paid:              2
payments_without_schedule_id:       13,169
```

Examples:

- `LN-20260328-8374`: status `paid`, total ?6,200, paid ?0, balance ?6,200
- `LN-20260328-4019`: status `paid`, total ?6,200, paid ?1,525, balance ?4,675
- `LN-20260417-1482`: total ?15,080, paid ?45,240, overpaid ?30,160

## Findings

### 1. Payment Encoder Records Payments But Does Not Update Schedules or Loan Status

File: `app/(payment-encoder)/index.tsx`

The payment encoder creates a payment:

```ts
payment.loanId = data.selectedLoanId;
payment.amount = parseFloat(data.amount);
payment.paymentDate = parseISO(data.paymentDate).getTime();
payment.collectorId = loan.collectorId;
```

But it does not:

- update `payment_schedules.status`
- mark schedules as `paid`, `partial`, or `late`
- auto-mark the loan as `paid`
- set `schedule_id`
- recompute loan status

Impact:

- Balance calculations based on `sum(payments.amount)` may be correct.
- Schedule-based reports, borrower schedule UI, overdue watchlists, PAR, aging, and collection efficiency can remain wrong because schedules stay `pending`.

### 2. Payments Are Almost Never Linked to Specific Schedules

Schema supports `payments.schedule_id`, but local data shows:

```text
payments_without_schedule_id = 13,169
payment count = 13,170
```

Impact:

- The system cannot reliably determine which installment a payment was intended for.
- Partial payments cannot be precisely allocated.
- Schedule statuses must be inferred from cumulative totals, but current logic does not fully do that.

### 3. Admin Partial-Payment Allocation Is Not Cumulative

File: `app/(admin)/payments/new.tsx`

Admin payment allocation loops through schedules using only the new payment amount:

```ts
let remainingAlloc = paymentAmount;
for (const sched of schedules) {
  if (sched.status === 'paid') continue;
  if (remainingAlloc >= sched.scheduledAmount) {
    remainingAlloc -= sched.scheduledAmount;
    sched.status = 'paid';
  } else {
    sched.status = 'partial';
    remainingAlloc = 0;
  }
}
```

Problem scenario:

```text
Installment due: ?100
Payment 1:       ?40  -> schedule becomes partial
Payment 2:       ?60  -> code compares 60 >= 100, false, schedule remains partial
```

Impact:

- Partial schedules may never become paid.
- Aging/PAR may remain inflated.
- Suggested next payment can show the full schedule amount even after a partial payment.

### 4. Admin Payment Flow May Over-Create Savings Deposits

File: `app/(admin)/payments/new.tsx`

When a schedule becomes paid, admin payment flow creates a savings transaction:

```ts
st.amount = l.depositAmount;
```

But `l.depositAmount` appears to represent the total savings/deposit amount for the whole loan, not the per-installment portion.

Example:

```text
Loan deposit:      ?50 total
Installment count: 40
Potential created: ?50 x 40 = ?2,000
Expected if total: ?50
```

Impact:

- Borrower savings balances may be overstated.
- Balance sheet liabilities may be overstated.
- Admin-created payments behave differently from payment-encoder-created payments.

### 5. Renewal Logic Can Leave Old Loans Active

File: `src/services/LoanService.ts`

Renewal closure only runs when `deductedAmount > 0`:

```ts
if (status === 'active' && isReloan && previousLoanId && (deductedAmount || 0) > 0) {
  oldLoan.status = 'paid';
  create closing payment;
  mark old schedules paid;
}
```

Read-only DB scan found:

```text
renewals_old_loan_not_paid = 2
```

Examples:

```text
old loan LN-20260328-7847 remains active, renewed by LN-20260328-1495, deducted_amount null
old loan LN-20260328-1318 remains active, renewed by LN-20260328-2182, deducted_amount 0
```

Impact:

- Some borrowers can have multiple active loans.
- Renewal reports and active-loan reports become inconsistent.
- Old schedules may remain pending/overdue after renewal.

### 6. Renewal Balance Calculation Differs Between Screens

Loan encoder path calculates old balance as:

```ts
oldLoan.totalAmount - payments
```

Admin loan path calculates old balance as:

```ts
oldLoan.totalAmount + penalties - payments
```

Impact:

- Renewal deduction can differ depending on which screen creates the loan.
- Penalties may be ignored in one path.
- Net proceeds can be inconsistent.

### 7. Actual Local Data Contains Paid Loans With Remaining Balances

Read-only scan found:

```text
paid_status_with_balance = 270
```

This means many loans marked `paid` still have `totalAmount - payments > 1`.

Possible causes:

- Renewed loans are marked paid via renewal even if payments do not sum to total.
- Legacy imported/migrated data may encode paid status independently from payment history.
- Closing payments may be missing or incomplete.

Impact:

- Balance reports that trust `status = paid` can disagree with reports that calculate balance from payments.
- Borrower-facing history and admin reports may not reconcile.

### 8. Some Loans Are Overpaid

Read-only scan found:

```text
overpaid_loans = 2
```

Largest example:

```text
LN-20260417-1482
totalAmount: ?15,080
paid:        ?45,240
overpaid:    ?30,160
```

Impact:

- Balance clamps to zero in many screens, hiding the overpayment.
- Cash, revenue, and collection reporting can be inflated.
- There is no clear overpayment/refund/credit workflow observed.

### 9. Multiple Active Loans Exist for Some Borrowers

Read-only scan found:

```text
borrowers_with_multiple_active_loans = 3
```

Impact:

- Product logic appears to discourage parallel active loans, but data contains them.
- Payment encoder can show multiple active loans for one borrower.
- Borrower dashboard outstanding balance sums all active/defaulted loans, so duplicates matter.

### 10. PAR and Portfolio Computations Mix Principal and Total Receivable Concepts

File: `src/services/KpiCalculator.ts`

PAR uses:

```ts
glp = sum(activeLoans.principalAmount)
overdueOutstanding = principalAmount - sum(payments.amount)
```

Other balances use:

```ts
loan.totalAmount + penalties - payments
```

Problem:

- Payments include principal, interest, fees, savings, and insurance portions.
- Subtracting full payments from principal understates outstanding principal.
- Schedule statuses are unreliable when payment encoder does not update schedules.

Impact:

- PAR may be understated or overstated.
- `totalOutstandingPrincipal` in `MfiKpiService` is actually total receivable outstanding, not principal-only outstanding.

### 11. Interest Income Calculation Likely Overstates Interest

File: `src/services/KpiCalculator.ts`

Current logic:

```ts
const principalRatio = loan.principalAmount / loan.totalAmount;
const interestPortion = p.amount * (1 - principalRatio);
```

But `loan.totalAmount` includes:

```text
principal + interest + deposit/savings + insurance
```

So the calculated “interest portion” includes interest plus non-interest fee/savings/insurance components.

Impact:

- Income statement operating revenue may include deposit/insurance/savings components as income.
- Renewal closing payments may contribute artificial interest income.
- Profitability KPIs can be distorted.

### 12. Audit Term-vs-Schedule Count Check Can False-Positive

File: `src/services/AuditService.ts`

Audit compares:

```ts
loanSchedules.length !== loan.term
```

But calculator intentionally maps term to payment count:

```text
6 months weekly -> 24 payments
3 months daily  -> 90 payments
40 days daily   -> 40 payments
```

Impact:

- Valid loans can be reported as schedule/term mismatches.
- Audit noise may hide real issues.

### 13. Cash Attribution Depends on Who Encoded the Payment

File: `src/services/CashService.ts`

Collector cash balance uses:

```ts
payments where collector_id = collectorId
minus approved remittances
```

Payment encoder sets:

```ts
payment.collectorId = loan.collectorId
```

Admin payment screen sets:

```ts
p.collectorId = user?.id
```

Impact:

- If an admin records a payment for a collector’s loan, that cash is attributed to the admin user rather than the loan’s assigned collector.
- Collector cash-in-transit can be wrong.
- Remittance reconciliation can be wrong.

## Overall Risk Areas

### Highest Risk

- Payment creation paths are inconsistent.
- Schedule statuses are not reliably derived from payments.
- `schedule_id` is unused, making partial allocation fragile.
- Local data already shows reconciliation problems.

### Medium Risk

- Renewal closure conditions can leave old loans active.
- Cash attribution differs by payment entry screen.
- KPI/PAR/income calculations mix accounting concepts.

### Lower Risk / Audit Noise

- Calculator tests pass for the current intended formula.
- No orphan payments or schedules were found in the local DB scan.

## Suggested Follow-Up Questions Before Fixing

No changes were made, but before implementing fixes the product/accounting rules should be clarified:

1. Is `depositAmount` a total loan savings amount or a per-installment savings amount?
2. Should payment allocation be FIFO across schedules by due date?
3. Should all payments always link to a `schedule_id`, or should some remain loan-level payments?
4. When a renewal closes an old loan, should a closing payment always be created even if the old balance is zero?
5. Should paid status be based strictly on payment totals, or can migrated/renewed loans be marked paid without matching payments?
6. Should collector cash attribution follow the loan’s collector or the user who encoded the payment?
7. Should PAR be based on principal outstanding, total receivable outstanding, or another portfolio definition?
8. Should deposits/savings and insurance be treated as revenue, liabilities, deductions, or pass-through amounts?

## Recommended Fix Direction

This section is advisory only; no changes were made.

1. Centralize payment posting into a service used by both admin and payment encoder flows.
2. Centralize balance computation into one helper/service.
3. Make schedule allocation cumulative and deterministic.
4. Decide whether to use `payments.schedule_id`; if yes, enforce it during payment posting.
5. Clarify savings/deposit handling before changing payment-to-savings logic.
6. Normalize renewal closure behavior so old loans cannot remain active after renewal.
7. Separate principal outstanding, total receivable outstanding, and income-recognition calculations.
8. Add regression tests for:
   - partial payment then completing payment
   - payment encoder schedule/status update
   - overpayment handling
   - renewal closure with zero balance
   - cash attribution
   - PAR computation

## Conclusion

Loan creation math is relatively well covered and passed the focused calculator tests. The major correctness risks are in how payments are posted and then interpreted by schedules, loan status, renewal closure, cash accounting, and KPI/reporting layers.

The system currently has enough data inconsistencies to justify a dedicated reconciliation/fix plan before making functional changes.
