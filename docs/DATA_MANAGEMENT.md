# Data Management

This document explains how the POSCursor system handles data migration from Excel files to the WatermelonDB and Supabase backend.

## 📂 Data Sources

The `data/` directory contains various Excel files used as the "source of truth" during the initial migration and ongoing data reconciliation:

- **`DCM-as-of-march-21.xlsx`**: The primary master database for active loans as of March 21, 2026.
- **`Weekly-Collection (1) (1).xlsx`**: Recent collection activities for weekly-payment loans.
- **`Weekly Clients.xlsx`**: Master list of borrowers for weekly-payment loans.

## 🔄 Migration Workflow

1.  **Extraction**: The `scripts/extract-excel.js` script reads the Excel files and converts them into structured JSON fragments.
2.  **Mapping**: A mapping JSON (`data/loan_mapping.json`) is generated to correlate Excel borrower IDs with system IDs.
3.  **Ingestion**: The `scripts/import_excel.js` script processes the JSON fragments and creates records in:
    - **`borrowers`**: Personal information and contact details.
    - **`loans`**: Loan terms, amounts, and statuses.
    - **`payment_schedules`**: Amortization schedules based on the loan terms.
    - **`payments`**: Historical payment records.

## 🧪 Reconciliation and Auditing

To ensure mathematical parity between the Excel source and the application:
- Run `scripts/verify_excel_vs_supabase.js` to compare totals and balances.
- Run `scripts/deep_verify.js` to identify any orphan records or missing schedules.

## ⚠️ Notes on Excel Formatting
The system expects specific columns and header names. Any changes to the Excel structure may require updates to the extraction logic in `scripts/extract-excel.js`.
