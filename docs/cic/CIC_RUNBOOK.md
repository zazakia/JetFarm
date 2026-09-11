# CIC Credit Reporting Runbook

**System:** POSCursor (POS Cursor)  
**Regulation:** RA 9510 — Credit Information System Act  
**Provider Code:** Configured in app → Admin → CIC Settings  
**Last updated:** 2026-07-09

---

## Overview

This runbook covers all operational tasks for the CIC monthly submission pipeline:

1. [Monthly Regular Submission](#1-monthly-regular-submission) — due by 10th of each month
2. [Handling a Dispute Correction Notice (Special Submission)](#2-special-submission--dispute-correction)
3. [Reviewing a Validation Report](#3-reviewing-a-validation-report)
4. [Updating CIC Settings](#4-updating-cic-settings)
5. [Responding to a CIC Portal Rejection](#5-responding-to-cic-portal-rejection)
6. [Troubleshooting Common Errors](#6-troubleshooting-common-errors)

---

## 1. Monthly Regular Submission

### Internal Deadlines

| Day of Month | Task |
|---|---|
| 3rd | Run data extraction |
| 5th | Review and resolve validation errors |
| 8th | Generate final file and upload to CIC portal |
| 10th | **CIC hard deadline** (do not miss) |

### Step-by-Step

**Step 1 — Run Extraction (by 3rd)**
1. Open the app → Admin → CIC Reporting
2. Check the Deadline Status banner confirms the correct reporting period (previous month)
3. Tap **"Run Monthly Extraction"**
4. Wait for the extraction to complete (usually < 1 minute)
5. The system will show: total borrowers extracted, total loans extracted, and a validation summary

**Step 2 — Review Validation Report (by 5th)**
1. After extraction, the Validation Report screen will open automatically
2. Check **Blocking Errors** first (red section) — these must all be cleared before proceeding
3. Check **Subject Errors** — each failed borrower is listed with the specific missing field
4. Check **Warnings** — these are non-blocking but should be addressed for data quality

**Step 3 — Fix Validation Errors**

For each failed borrower:
1. Note the membership number and missing field (e.g., "Middle Name", "Government ID")
2. Go to Admin → Borrowers → find the borrower
3. Edit the profile and fill in the missing field
4. Return to CIC Reporting and re-run extraction (repeat until all errors are cleared)

> **Common fixes:**
> - **Missing Middle Name**: Ask the borrower directly; update their profile
> - **Missing Government ID**: Collect TIN, SSS, or GSIS number from the borrower
> - **Missing Date of Birth**: Verify from valid ID on file
> - **Placeholder TIN (000000000)**: Replace with actual TIN; if not available, enter SSS number

**Step 4 — Generate Submission File (by 8th)**
1. Once validation passes (green status), tap **"Generate Regular File"**
2. The system generates a `.csv` file named `{ProviderCode}_{MM}{YYYY}_R.csv`
3. The file is saved to the app's local documents folder
4. Share/export the file to your computer for upload

**Step 5 — Upload to CIC Portal**
1. Log in to the CIC Online Encoding and Reporting (OER) portal
2. Select "Batch Upload" → upload the Regular Submission file
3. Note the portal's confirmation reference number
4. Return to the app → Admin → CIC Reporting
5. Tap **"Log Manual Submission"**
6. Enter the portal reference number and submission date
7. The submission is recorded in the audit log

> ⚠️ **Do not automate portal login.** CIC requires manual batch operator authentication. The app only generates the file — upload must be done manually.

---

## 2. Special Submission — Dispute Correction

A Special Submission is required when:
- You receive a **Dispute Correction Notice** from CIC
- A borrower disputes their credit record
- A data error is found in a previously submitted record

**SLA: Special Submission must be filed within 5 working days of receiving the notice.**

### Step-by-Step

**Step 1 — Log the Dispute Notice**
1. Admin → CIC Reporting → **"Trigger Special Submission"**
2. Enter the Dispute Reference Number from the CIC notice
3. Enter the Reporting Period the dispute relates to (e.g., 2024-05)
4. Select the affected borrower(s) from the list

**Step 2 — Fix the Disputed Data**
1. Identify what data CIC disputed (the notice will specify the field)
2. Update the borrower's profile with the corrected data
3. Gather supporting documents (valid ID, signed form, etc.) for your own records

**Step 3 — Generate Special File**
1. After fixing the data, tap **"Generate Special File"**
2. The system generates a file named `{ProviderCode}_{MM}{YYYY}_S.csv`
3. This file contains ONLY the corrected borrower records (not all borrowers)

> ⚠️ **Regular and Special files must NEVER be merged.** The app enforces this — they are always separate.

**Step 4 — Upload to CIC Portal**
1. Log in to CIC OER portal
2. Select "Special Submission" (not Regular) for the upload
3. Upload the `_S.csv` file
4. Log the submission in the app with the portal reference number

---

## 3. Reviewing a Validation Report

### Understanding the Report

| Status | Meaning | Action |
|---|---|---|
| ✅ Passed | All records are complete and valid | Proceed to file generation |
| ⚠️ Partial | Some records have errors | Fix errors for failed records; remaining records can proceed |
| ❌ Failed | Critical errors block entire submission | Fix all blocking errors before proceeding |

### Common Validation Errors and Fixes

| Error | Field | Fix |
|---|---|---|
| "No government ID found" | gov_id | Enter TIN, SSS, or GSIS number in borrower profile |
| "Date of birth is a placeholder" | date_of_birth | Enter actual DOB from valid ID |
| "TIN contains a dummy value" | tin_number | Clear the field and enter the real TIN |
| "Full address is blank" | address | Enter barangay, city/municipality, province |
| "Middle name missing" | middle_name | Enter middle name in borrower profile (warning only) |
| "Orphaned contract" | provider_subject_no | Loan has no borrower record — check loan encoding |
| "Duplicate membership number" | provider_subject_no | Two borrowers share the same member ID — fix in profile |

---

## 4. Updating CIC Settings

1. Admin → CIC Reporting → Settings (gear icon)
2. **Provider Code** — must match your CIC-registered provider code exactly
3. **Default Contract Type** — 22 for Microfinance (standard cooperative lending)
4. **Loan Type Map** — if you have multiple loan products, map each to the correct CIC code:
   - `22` = Microfinance / Salary Loan
   - `23` = Personal Loan
   - `14` = Business Loan (check CIC CI domain sheet)
5. **Deadlines** — adjust if your internal schedule differs from the default (extract=3, validate=5, submit=8)
6. **Alerts** — enable both push and email; enter the email address for the admin who handles CIC

> ⚠️ **Provider Code is critical.** An incorrect provider code will cause CIC to reject the entire submission. Verify with your CIC registration documents.

---

## 5. Responding to a CIC Portal Rejection

If the portal rejects your uploaded file:

1. Note the rejection error code from the portal
2. In the app → CIC Reporting, tap **"Log Manual Submission"** and set status to "Rejected"
3. Enter the portal error code in the OER Response field

**Common rejection reasons:**

| Portal Error | Meaning | Fix |
|---|---|---|
| Invalid Provider Code | Your provider code is wrong | Update in CIC Settings |
| Duplicate submission | File already submitted for this period | Check submission history; may need a correction (Special Submission) |
| Invalid date format | Date field not in `ddmmyyyy` format | Report to app developer — this is a bug |
| Record count mismatch | FT footer count doesn't match row count | Report to app developer — this is a bug |
| Missing required field | A required column is empty | Run validation again and fix reported errors |

---

## 6. Troubleshooting Common Errors

### "Extraction failed: Borrower fetch error"
- Check internet connection (Supabase requires connectivity)
- Check if Supabase service is online
- Try again after a few minutes

### "X borrowers missing CIC fields" on dashboard
- This is a proactive warning, not a blocking error
- Use the Missing Fields report to identify which borrowers need data entry
- Address these during normal office hours, not just at submission time

### "Orphaned loan — no matching borrower"
- A loan was encoded without a proper borrower link
- Go to the loan record and check the borrower_id
- If the borrower exists but has no membership_number, add one

### Special Submission deadline approaching
- The app will show a warning when 5 working days remain
- If you cannot generate the Special Submission in time, contact CIC directly to request an extension (this is rare and must be documented)

---

## File Naming Convention

| Type | Format | Example |
|---|---|---|
| Regular Submission | `{ProviderCode}_{MM}{YYYY}_R.csv` | `PF022730_052024_R.csv` |
| Special Submission | `{ProviderCode}_{MM}{YYYY}_S.csv` | `PF022730_052024_S.csv` |

---

## Contacts

| Contact | Role |
|---|---|
| CIC Helpdesk | For portal access issues and submission questions |
| Cooperative IT Admin | For app configuration and data issues |
| Cooperative Compliance Officer | PCP/DRCP — signs off on submission before upload |

---

## Audit Log

Every extraction, validation run, and submission (including failures and rejections) is automatically recorded in the CIC Submissions audit log. This log is:
- **Append-only** — records cannot be deleted
- Viewable under Admin → CIC Reporting → Submission History
- The source of truth for compliance disputes

**Never manually edit or delete entries from this log.**
