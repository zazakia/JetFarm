# Loan Renewals

Loan Renewals allow borrowers to transition from an existing loan to a new one, often with streamlined processing and historical linking.

## Key Features
- **Renewal Toggle**: In the Loan Encoder, admins can mark a new loan as a "Renewal".
- **Previous Loan Selection**: When "Renewal" is enabled, the system automatically fetches and displays active/closed loans for that borrower to link as the "source" loan.
- **Visual Badging**: Renewed loans are marked with a distinct purple "Renewal" badge in the borrower's loan history.
- **Traceability**: The UI shows the specific Loan Number that the current loan was renewed from.

## Database Schema
The `app_loans` table includes:
- `is_reloan`: Boolean flag indicating if the loan is a renewal.
- `previous_loan_id`: UUID reference to the original loan.

## UI Components
- **Loan Encoder**: `app/(loan-encoder)/index.tsx`. Includes the renewal toggle and previous loan selector.
- **Borrower Details**: `app/(admin)/borrowers/[id].tsx`. Features the "Loan History" section with renewal badges and links.

## Business Logic
- **Linking**: When creating a renewal, the `previous_loan_id` is saved to establish the relationship.
- **History View**: The sorted history view ensures that the sequence of loans (Original -> Renewal 1 -> Renewal 2) is clear to admins.
