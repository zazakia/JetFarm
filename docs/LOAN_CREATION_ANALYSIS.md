# Loan Creation Code Analysis

## Summary
The codebase has **2 main places** where loans are created (WatermelonDB local database). The Loan model has 27 fields defined, but only 15-17 are being set during loan creation. **Critical fields `collector_id` and `encoded_by` are NEVER set when creating loans.**

---

## Loan Model Definition
**File:** [src/database/models/Loan.ts](../src/database/models/Loan.ts)

### All Fields Defined (27 total):
```typescript
@relation('borrowers', 'borrower_id') borrower: any;
@field('borrower_id') borrowerId: string;
@field('loan_number') loanNumber: string;
@field('principal_amount') principalAmount: number;
@field('interest_rate') interestRate: number;
@field('interest_type') interestType: string;
@field('term') term: number;
@field('term_unit') termUnit: string;
@field('frequency') frequency: string;
@field('total_amount') totalAmount: number;
@field('installment_amount') installmentAmount: number;
@field('deposit_amount') depositAmount: number;
@field('insurance_amount') insuranceAmount: number;
@date('release_date') releaseDate: number;
@date('first_payment_date') firstPaymentDate: number;
@date('maturity_date') maturityDate: number;
@field('status') status: string;
@field('is_reloan') isReloan: boolean;
@field('previous_loan_id') previousLoanId: string;
@field('encoded_by') encodedBy: string;                    // ⚠️ NOT BEING SET
@field('collector_id') collectorId: string;                // ⚠️ NOT BEING SET
@date('created_at') createdAt: number;
@date('updated_at') updatedAt: number;
@children('payments') payments: any;
@children('payment_schedules') paymentSchedules: any;
```

---

## 1. LOAN CREATION IN LOAN ENCODER (Main App)

**File:** [app/(loan-encoder)/index.tsx](../app/(loan-encoder)/index.tsx#L116)  
**Line:** 116-137

### Code:
```typescript
await database.collections.get<Loan>('loans').create(loan => {
    loan._raw.id = loanId;
    loan.borrowerId = data.borrowerId;
    loan.loanNumber = ln;
    loan.principalAmount = parseFloat(data.principal);
    loan.interestRate = parseFloat(data.ratePercent);
    loan.interestType = data.interestType;
    loan.term = parseInt(data.term, 10);
    loan.termUnit = data.termUnit;
    loan.frequency = data.frequency;
    loan.installmentAmount = calcResult.installmentAmount;
    loan.totalAmount = calcResult.totalAmount;
    loan.depositAmount = parseFloat(data.deposit);
    loan.insuranceAmount = parseFloat(data.insurance);
    loan.status = 'active';
    loan.releaseDate = new Date().getTime();
    loan.maturityDate = calcResult.maturityDate.getTime();
});
```

### Fields Being Set:
- ✅ id (loanId)
- ✅ borrowerId (from form)
- ✅ loanNumber (generated)
- ✅ principalAmount
- ✅ interestRate
- ✅ interestType
- ✅ term
- ✅ termUnit
- ✅ frequency
- ✅ installmentAmount
- ✅ totalAmount
- ✅ depositAmount
- ✅ insuranceAmount
- ✅ status (hardcoded 'active')
- ✅ releaseDate (current date)
- ✅ maturityDate (calculated)

### Fields NOT Being Set:
- ❌ **collector_id** (no value provided)
- ❌ **encoded_by** (no value provided)
- ❌ firstPaymentDate
- ❌ isReloan
- ❌ previousLoanId
- ❌ createdAt (WatermelonDB may auto-generate)
- ❌ updatedAt (WatermelonDB may auto-generate)

### Context:
This is the PRIMARY loan creation flow used by loan encoders to create loans for borrowers. The loans are created as "active" status immediately after creation.

---

## 2. LOAN CREATION IN ADMIN PANEL

**File:** [app/(admin)/loans/new.tsx](../app/(admin)/loans/new.tsx#L80)  
**Line:** 80-105

### Code:
```typescript
await database.collections.get<Loan>('loans').create(loan => {
    loan._raw.id = loanId;
    loan.borrowerId = data.borrowerId;
    loan.loanNumber = ln;
    loan.principalAmount = parseFloat(data.principal);
    loan.interestRate = parseFloat(data.ratePercent);
    loan.interestType = data.interestType;
    loan.term = parseInt(data.term, 10);
    loan.termUnit = data.termUnit;
    loan.frequency = data.frequency;
    loan.installmentAmount = calcResult.installmentAmount;
    loan.totalAmount = calcResult.totalAmount;
    loan.depositAmount = parseFloat(data.deposit);
    loan.insuranceAmount = parseFloat(data.insurance);
    loan.status = status;  // <- Can be 'pending' or 'active'
    if (status === 'active') {
        loan.releaseDate = new Date().getTime();
        loan.maturityDate = calcResult.maturityDate.getTime();
    }
});
```

### Fields Being Set:
- ✅ id (loanId)
- ✅ borrowerId (from form)
- ✅ loanNumber (generated)
- ✅ principalAmount
- ✅ interestRate
- ✅ interestType
- ✅ term
- ✅ termUnit
- ✅ frequency
- ✅ installmentAmount
- ✅ totalAmount
- ✅ depositAmount
- ✅ insuranceAmount
- ✅ status (pending or active)
- ✅ releaseDate (only if status='active')
- ✅ maturityDate (only if status='active')

### Fields NOT Being Set:
- ❌ **collector_id** (no value provided)
- ❌ **encoded_by** (no value provided)
- ❌ firstPaymentDate
- ❌ isReloan
- ❌ previousLoanId
- ❌ createdAt
- ❌ updatedAt

### Context:
Admin panel allows creating loans with status that can be 'pending' or 'active'. Only sets release/maturity dates if active.

---

## 3. LOAN CREATION IN TESTS

**File:** [src/services/__tests__/SyncService.integration.test.ts](../src/services/__tests__/SyncService.integration.test.ts#L221)  
**Line:** 221-231

### Code:
```typescript
testLoan = await mockTestDb.get<Loan>('loans').create((record) => {
    record.loanNumber = 'LN-123';
    record.principalAmount = 10000;
    record.interestRate = 5;
    record.term = 12;
    record.termUnit = 'months';
    record.status = 'active';
    record.depositAmount = 500;
    record.insuranceAmount = 200;
});
```

### Fields Being Set:
- ✅ loanNumber
- ✅ principalAmount
- ✅ interestRate
- ✅ term
- ✅ termUnit
- ✅ status
- ✅ depositAmount
- ✅ insuranceAmount

### Fields NOT Being Set:
- ❌ **borrowerId** (not set - critical)
- ❌ **collector_id** (no value provided)
- ❌ **encoded_by** (no value provided)
- ❌ interestType
- ❌ frequency
- ❌ installmentAmount
- ❌ totalAmount
- ❌ releaseDate
- ❌ maturityDate

### Context:
This is a minimal test setup for SyncService integration tests. Not representative of real loan creation.

---

## 4. NO LOAN CREATION IN BOOTSTRAP SCRIPT

**File:** [bootstrap-data.mjs](../scripts/bootstrap-data.mjs)

The bootstrap script **only creates borrowers**, not loans. It creates borrowers with:
- collector_id
- created_by

But no loan records are created.

---

## Critical Issues Found

### 1. ⚠️ `collector_id` NOT BEING SET
- **Model Field:** Defined in Loan.ts
- **Database Column:** Required for sync filtering per [SyncService.ts:150](../src/services/SyncService.ts#L150)
- **Status in Creation:** **NEVER SET**
- **Impact:** Loans created through UI won't have collector assignment. When synced to Supabase, `collector_id` will be NULL.

### 2. ⚠️ `encoded_by` NOT BEING SET
- **Model Field:** Defined in Loan.ts
- **Database Column:** In schema but optional
- **Status in Creation:** **NEVER SET**
- **Impact:** No audit trail of which user/encoder created the loan.

### 3. ⚠️ `borrower_id` NOT SET IN TEST
- The test in SyncService.integration.test.ts doesn't set borrowerId
- This is just a test setup issue, but indicates potential data integrity gap

### 4. ✅ `firstPaymentDate` NOT SET (By Design)
- Not set during creation - appears to be set separately when payment schedule is created

---

## Comparison: App vs Admin vs Test

| Field | Loan Encoder | Admin | Test |
|-------|---|---|---|
| borrowerId | ✅ Yes | ✅ Yes | ❌ No |
| loanNumber | ✅ Yes | ✅ Yes | ✅ Yes |
| principalAmount | ✅ Yes | ✅ Yes | ✅ Yes |
| interestRate | ✅ Yes | ✅ Yes | ✅ Yes |
| interestType | ✅ Yes | ✅ Yes | ❌ No |
| term | ✅ Yes | ✅ Yes | ✅ Yes |
| termUnit | ✅ Yes | ✅ Yes | ✅ Yes |
| frequency | ✅ Yes | ✅ Yes | ❌ No |
| installmentAmount | ✅ Yes | ✅ Yes | ❌ No |
| totalAmount | ✅ Yes | ✅ Yes | ❌ No |
| depositAmount | ✅ Yes | ✅ Yes | ✅ Yes |
| insuranceAmount | ✅ Yes | ✅ Yes | ✅ Yes |
| releaseDate | ✅ Yes (always) | ✅ Yes (conditional) | ❌ No |
| maturityDate | ✅ Yes (always) | ✅ Yes (conditional) | ❌ No |
| status | ✅ Yes ('active') | ✅ Yes (param) | ✅ Yes ('active') |
| **collector_id** | ❌ **No** | ❌ **No** | ❌ **No** |
| **encoded_by** | ❌ **No** | ❌ **No** | ❌ **No** |

---

## Default Values / Assumptions

Based on the code analysis:

1. **status:** Hardcoded to 'active' in loan-encoder, configurable in admin
2. **releaseDate:** Set to current timestamp when loan created
3. **maturityDate:** Calculated from term and frequency using LoanCalculatorService
4. **loan_id:** Generated using UUID v4
5. **collector_id:** **NO DEFAULT** - NULL in database
6. **encoded_by:** **NO DEFAULT** - NULL in database

---

## Recommendations

1. **URGENT:** Set `collector_id` when creating loans (get from current user context)
2. **URGENT:** Set `encoded_by` when creating loans (get from current user ID)
3. Add these fields to the admin panel loan creation form
4. Update test fixtures to include borrowerId and collector_id
5. Consider adding auto-fill logic in SyncService as fallback (similar to borrower created_by logic)

---

## File References
- Loan Model: [src/database/models/Loan.ts](../src/database/models/Loan.ts)
- Loan Encoder Creation: [app/(loan-encoder)/index.tsx](../app/(loan-encoder)/index.tsx#L116)
- Admin Creation: [app/(admin)/loans/new.tsx](../app/(admin)/loans/new.tsx#L80)
- Test Creation: [src/services/__tests__/SyncService.integration.test.ts](../src/services/__tests__/SyncService.integration.test.ts#L221)
- Sync Config: [src/services/SyncService.ts](../src/services/SyncService.ts#L150)
- Bootstrap: [bootstrap-data.mjs](../scripts/bootstrap-data.mjs)
