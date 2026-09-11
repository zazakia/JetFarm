# Savings Module

The Savings Module allows borrowers to maintain a savings balance within the MFI system. Savings are integrated into the payment workflow, ensuring consistent capital buildup for borrowers.

## Key Features
- **Integrated Savings**: A portion of each payment (defined in the loan terms) can be automatically allocated to savings.
- **Manual Deposits/Withdrawals**: Admins can record manual savings transactions (Cash Deposit, Cash Withdrawal, Loan Withdrawal).
- **Interest Posting**: System supports tracking interest earned on savings (as a transaction type).
- **Financial Integration**: Savings balances are tracked as **Liabilities** in the Balance Sheet (MFI KPI Service).

## Database Schema
The module uses the `app_savings_transactions` table:
- `borrower_id`: Link to the borrower.
- `type`: `deposit`, `withdraw_cash`, `withdraw_loan`, `interest`.
- `amount`: Transaction value.
- `date`: Transaction timestamp.
- `notes`: Optional description.

## UI Components
- **Borrower Savings Screen**: Located at `app/(admin)/borrowers/[id]/savings.tsx`. Shows balance and transaction history.
- **Savings Summary**: Integrated into the Borrower Details overview.

## Logic Implementation
- **Sync**: Handled via `SyncService.ts` using the `app_` table prefix.
- **Reporting**: `MfiKpiService.ts` calculates the total savings liability by summing all transactions for all borrowers.
