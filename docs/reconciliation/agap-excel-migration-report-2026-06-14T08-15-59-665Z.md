# AGAP Excel Migration Analysis

Generated: 2026-06-14T08:15:59.665Z

Mode: read-only workbook analysis. No database writes were performed.

## Source Files

- SUMMARY workbook: `docs\SUMMARY.xlsx`
- Collection workbook: `E:/Users/HI/Downloads/Spreadsheets/COLLECTION SHEET.xlsx`

## Business Logic Inferred And Matched To App

- Interest: Principal x 20% flat.
- Weekly amortization: Principal/20 + total interest/20 + principal*1% savings + PHP 10 LPF.
- Total receivable: weekly amortization x 20.
- Deductions: ARF 2% + CPF 4% + MEM 100 + LHF 100 + RSF 60 + Doc Stamp 45 + previous balance for reloans.
- Net proceeds: Principal - deductions.

## Summary

| sourceSummaryPath | sourceCollectionPath | sourceCollectionSheets | parsedSheets | borrowers | borrowersWithLoans | loans | payments | rollovers | totalPrincipal | totalInterest | totalSavings | totalReceivable | totalStatedBalance | issueCount |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| docs\SUMMARY.xlsx | E:/Users/HI/Downloads/Spreadsheets/COLLECTION SHEET.xlsx | 90 | 90 | 298 | 289 | 371 | 490 | 64 | 5481500 | 1096300 | 1096300 | 7748300 | 1589530 | 465 |


## Sheet Coverage

| sheet | parsed | group | date | rows | paymentColumns | reason |
| --- | --- | --- | --- | --- | --- | --- |
| MARCH 16, 2026 | true |  | 2026-03-15 | 56 | 6 |  |
| MARCH 23, 2026 | true |  | 2026-03-22 | 57 | 6 |  |
| MARCH 30, 2026 | true |  | 2026-03-29 | 57 | 6 |  |
| March 17, 2026 | true |  | 2026-03-16 | 36 | 6 |  |
| March 24, 2026 | true |  | 2026-03-23 | 40 | 6 |  |
| March 31, 2026 | true |  | 2026-03-30 | 40 | 6 |  |
| April 6, 2026 | true |  | 2026-04-05 | 57 | 6 |  |
| April 13, 2026 | true |  | 2026-04-12 | 58 | 6 |  |
| April 20, 2026 | true |  | 2026-04-19 | 65 | 6 |  |
| April 7, 2026 | true |  | 2026-04-06 | 40 | 6 |  |
| April 14, 2026 | true |  | 2026-04-13 | 40 | 6 |  |
| April 21, 2026 | true |  | 2026-04-20 | 44 | 6 |  |
| April 27, 2026 | true |  | 2026-04-26 | 65 | 6 |  |
| May 4, 2026 | true |  | 2026-05-03 | 65 | 6 |  |
| May 11, 2026 | true |  | 2026-05-10 | 65 | 6 |  |
| JAN May 11, 2026 | true |  | 2026-05-10 | 20 | 6 |  |
| PALACIAN May 11, 2026 | true | PALACIAN | 2026-05-10 | 47 | 6 |  |
| JAN May 18, 2026 | true |  | 2026-05-17 | 20 | 6 |  |
| PALACIAN June 1, 2026 | true | PALACIAN | 2026-05-31 | 50 | 6 |  |
| PALACIAN June 8, 2026 | true | PALACIAN | 2026-06-07 | 38 | 6 |  |
| RALPH June 12, 2026 | true | RALPH | 2026-06-11 | 38 | 6 |  |
| JAN May 25, 2026 | true |  | 2026-05-24 | 20 | 6 |  |
| JAN June 1, 2026 | true |  | 2026-05-31 | 22 | 6 |  |
| JAN June 8, 2026 | true |  | 2026-06-07 | 18 | 6 |  |
| JANMARK June 15, 2026 | true |  | 2026-06-14 | 18 | 6 |  |
| PALACIAN May 18, 2026 | true | PALACIAN | 2026-05-17 | 47 | 6 |  |
| PALACIAN May 25, 2026 | true | PALACIAN | 2026-05-24 | 48 | 6 |  |
| May 19, 2026 | true |  | 2026-05-18 | 45 | 6 |  |
| May 26, 2026 | true |  | 2026-05-25 | 47 | 6 |  |
| June 2, 2026 | true |  | 2026-06-01 | 47 | 6 |  |
| June 9, 2026 | true |  | 2026-06-08 | 50 | 6 |  |
| June 16, 2026 | true |  | 2026-06-15 | 51 | 6 |  |
| May 12, 2026 | true |  | 2026-05-11 | 45 | 6 |  |
| May 5, 2026 | true |  | 2026-05-04 | 44 | 6 |  |
| SHEREL | true | SHEREL |  | 7 | 0 |  |
| April 28, 2026 | true |  | 2026-04-27 | 44 | 6 |  |
| March 25, 2026 | true |  | 2026-03-24 | 49 | 6 |  |
| April 1, 2026 | true |  | 2026-03-31 | 52 | 6 |  |
| April 8, 2026 | true |  | 2026-04-07 | 53 | 6 |  |
| April 15, 2026 | true |  | 2026-04-14 | 53 | 6 |  |
| April 22, 2026 | true |  | 2026-04-21 | 58 | 6 |  |
| April 29, 2026 | true |  | 2026-04-28 | 63 | 6 |  |
| May 6, 2026 | true |  | 2026-05-05 | 65 | 6 |  |
| May 13, 2026 | true |  | 2026-05-12 | 69 | 6 |  |
| May 20, 2026 | true |  | 2026-05-19 | 73 | 6 |  |
| May 27, 2026 | true |  | 2026-05-26 | 74 | 6 |  |
| June 3, 2026 | true |  | 2026-06-02 | 81 | 6 |  |
| June 10, 2026 | true |  | 2026-06-09 | 84 | 6 |  |
| JANMARK June 17, 2026 | true |  | 2026-06-16 | 54 | 6 |  |
| RALPH June 17, 2026 | true | RALPH | 2026-06-16 | 44 | 6 |  |
| May 21, 2026 | true |  | 2026-05-20 | 51 | 6 |  |
| May 28, 2026 | true |  | 2026-05-27 | 51 | 6 |  |
| June 4, 2026 | true |  | 2026-06-03 | 53 | 6 |  |
| June 11, 2026 | true |  | 2026-06-10 | 54 | 6 |  |
| June 18, 2026 | true |  | 2026-06-17 | 55 | 6 |  |
| April 9, 2026 | true |  | 2026-04-08 | 45 | 6 |  |
| April 16, 2026 | true |  | 2026-04-15 | 45 | 6 |  |
| April 23, 2026 | true |  | 2026-04-22 | 46 | 6 |  |
| April 30, 2026 | true |  | 2026-04-29 | 48 | 6 |  |
| May 7, 2026 | true |  | 2026-05-06 | 48 | 6 |  |
| May 14, 2026 | true |  | 2026-05-13 | 48 | 6 |  |
| March 18, 2026 | true |  | 2026-03-17 | 42 | 6 |  |
| March 19, 2026 | true |  | 2026-03-18 | 41 | 6 |  |
| March 26, 2026 | true |  | 2026-03-25 | 42 | 6 |  |
| April 2, 2026 | true |  | 2026-04-01 | 45 | 6 |  |
| March 20, 2026 | true |  | 2026-03-19 | 59 | 6 |  |
| April 10, 2026 | true |  | 2026-04-09 | 22 | 6 |  |
| April 17, 2026 | true |  | 2026-04-16 | 22 | 6 |  |
| April 24, 2026 | true |  | 2026-04-23 | 23 | 6 |  |
| May 1, 2026 | true |  | 2026-04-30 | 22 | 6 |  |
| May 8, 2026 | true |  | 2026-05-07 | 22 | 6 |  |
| May 15, 2026 | true |  | 2026-05-14 | 22 | 6 |  |
| May 22, 2026 | true |  | 2026-05-21 | 22 | 6 |  |
| May 29, 2026 | true |  | 2026-05-28 | 23 | 6 |  |
| June 5, 2026 | true |  | 2026-06-04 | 27 | 6 |  |
| June 12, 2026 | true |  | 2026-06-11 | 28 | 6 |  |
| June 19, 2026 | true |  | 2026-06-18 | 28 | 6 |  |
| SAN DIONISIOSALAY MAY 22, 2026 | true | SALAY & SAN DIONISIO | 2026-05-21 | 51 | 6 |  |
| SAN DIONISIOSALAY MAY 29, 2026 | true | SALAY & SAN DIONISIO | 2026-05-28 | 53 | 6 |  |
| SAN DIONISIOSALAY June 12, 2026 | true | SALAY & SAN DIONISIO | 2026-06-11 | 56 | 6 |  |
| SAN DIONISIOSALAY June 19, 2026 | true | SALAY & SAN DIONISIO | 2026-06-18 | 56 | 6 |  |
| SAN DIONISIOSALAY June 5, 2026 | true | SALAY & SAN DIONISIO | 2026-06-04 | 55 | 6 |  |
| SAN DIONISIO APRIL 17, 2026 | true | SALAY & SAN DIONISIO | 2026-04-16 | 46 | 6 |  |
| SAN DIONISIOSALAY APRIL 24, 202 | true | SALAY & SAN DIONISIO | 2026-04-23 | 49 | 6 |  |
| SAN DIONISIOSALAY MAY 1, 2026 | true | SALAY & SAN DIONISIO | 2026-04-30 | 49 | 6 |  |
| SAN DIONISIOSALAY MAY 8, 2026 | true | SALAY & SAN DIONISIO | 2026-05-07 | 49 | 6 |  |
| SAN DIONISIOSALAY MAY 15, 2026 | true | SALAY & SAN DIONISIO | 2026-05-14 | 49 | 6 |  |
| SAN DIONISIO PAST DUE | true | SAN DIONISIO |  | 5 | 2 |  |
| MONTHLY | true | MONTHLY |  | 5 | 17 |  |
| PAST DUE | true |  |  | 8 | 16 |  |


## Review Items

| level | type | borrower | loan | sheet | row | expected | actual | difference |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| warning | total_due_formula_mismatch | Teresa Agustin | AG-AG00005-C1-2025-10-03 | April 6, 2026 | 9 | 16880 | 13880 | -3000 |
| warning | total_due_formula_mismatch | Teresa Agustin | AG-AG00005-C1-2025-10-03 | April 13, 2026 | 9 | 16880 | 12880 | -4000 |
| warning | total_due_formula_mismatch | Teresa Agustin | AG-AG00005-C1-2025-10-03 | April 20, 2026 | 9 | 16880 | 12880 | -4000 |
| warning | total_due_formula_mismatch | Teresa Agustin | AG-AG00005-C1-2025-10-03 | April 27, 2026 | 9 | 16880 | 12880 | -4000 |
| warning | total_due_formula_mismatch | Teresa Agustin | AG-AG00005-C1-2025-10-03 | May 4, 2026 | 9 | 16880 | 12880 | -4000 |
| warning | total_due_formula_mismatch | Teresa Agustin | AG-AG00005-C1-2025-10-03 | May 11, 2026 | 9 | 16880 | 10880 | -6000 |
| warning | total_due_formula_mismatch | Teresa Agustin | AG-AG00005-C1-2025-10-03 | PALACIAN May 11, 2026 | 9 | 16880 | 10880 | -6000 |
| warning | total_due_formula_mismatch | Teresa Agustin | AG-AG00005-C1-2025-10-03 | PALACIAN June 1, 2026 | 9 | 10550 | 9880 | -670 |
| warning | total_due_formula_mismatch | Teresa Agustin | AG-AG00005-C1-2025-10-03 | PALACIAN June 8, 2026 | 9 | 10550 | 9880 | -670 |
| warning | total_due_formula_mismatch | Teresa Agustin | AG-AG00005-C1-2025-10-03 | PALACIAN May 18, 2026 | 9 | 10550 | 9880 | -670 |
| warning | total_due_formula_mismatch | Teresa Agustin | AG-AG00005-C1-2025-10-03 | PALACIAN May 25, 2026 | 9 | 10550 | 9880 | -670 |
| warning | total_due_formula_mismatch | Novelyn U. Garrote | AG-AG00010-C2-2026-02-15 | PALACIAN June 8, 2026 | 14 | 11660 | 11720 | 60 |
| warning | total_due_formula_mismatch | Novelyn U. Garrote | AG-AG00010-C2-2026-02-15 | RALPH June 12, 2026 | 14 | 12720 | 12780 | 60 |
| warning | total_due_formula_mismatch | Rebylen R. Tumaneng | AG-AG00012-C1-2025-10-10 | PALACIAN June 8, 2026 | 16 | 3010 | 2510 | -500 |
| warning | total_due_formula_mismatch | Rebylen R. Tumaneng | AG-AG00012-C1-2025-10-10 | RALPH June 12, 2026 | 16 | 3010 | 2510 | -500 |
| warning | total_due_formula_mismatch | Lenie L. Lopez | AG-AG00017-C2-2026-02-12 | RALPH June 12, 2026 | 18 | 8460 | 7460 | -1000 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | MARCH 30, 2026 | 24 | 2820 | 3230 | 410 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | April 6, 2026 | 24 | 2820 | 3230 | 410 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | April 13, 2026 | 24 | 4230 | 4640 | 410 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | April 20, 2026 | 24 | 4230 | 4640 | 410 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | April 27, 2026 | 24 | 5640 | 6050 | 410 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | May 4, 2026 | 24 | 4230 | 4640 | 410 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | May 11, 2026 | 24 | 4230 | 4640 | 410 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | PALACIAN May 11, 2026 | 22 | 4230 | 4640 | 410 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | PALACIAN June 1, 2026 | 22 | 4230 | 4640 | 410 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | PALACIAN June 8, 2026 | 20 | 2820 | 3230 | 410 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | RALPH June 12, 2026 | 20 | 4230 | 4640 | 410 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | PALACIAN May 18, 2026 | 22 | 4230 | 4640 | 410 |
| warning | total_due_formula_mismatch | Gladys L. Macabeo | AG-AG00020-C2-2026-02-15 | PALACIAN May 25, 2026 | 22 | 5640 | 6050 | 410 |
| warning | total_due_formula_mismatch | Glenda F. Orodio | AG-AG00024-C1-2025-11-07 | May 21, 2026 | 7 | 25320 | 24820 | -500 |
| warning | total_due_formula_mismatch | Glenda F. Orodio | AG-AG00024-C1-2025-11-07 | May 28, 2026 | 7 | 25320 | 23820 | -1500 |
| warning | total_due_formula_mismatch | Glenda F. Orodio | AG-AG00024-C1-2025-11-07 | June 4, 2026 | 7 | 25320 | 23820 | -1500 |
| warning | total_due_formula_mismatch | Glenda F. Orodio | AG-AG00024-C1-2025-11-07 | June 11, 2026 | 7 | 25320 | 23820 | -1500 |
| warning | total_due_formula_mismatch | Glenda F. Orodio | AG-AG00024-C1-2025-11-07 | June 18, 2026 | 7 | 25320 | 22820 | -2500 |
| warning | total_due_formula_mismatch | Glenda F. Orodio | AG-AG00024-C1-2025-11-07 | May 14, 2026 | 7 | 25320 | 24820 | -500 |
| warning | total_due_formula_mismatch | Eresim M. Lazatin Jr. | AG-AG00025-C1-2025-11-07 | May 21, 2026 | 8 | 9540 | 7940 | -1600 |
| warning | total_due_formula_mismatch | Eresim M. Lazatin Jr. | AG-AG00025-C1-2025-11-07 | May 28, 2026 | 8 | 9540 | 7940 | -1600 |
| warning | total_due_formula_mismatch | Eresim M. Lazatin Jr. | AG-AG00025-C1-2025-11-07 | June 4, 2026 | 8 | 9540 | 7940 | -1600 |
| warning | total_due_formula_mismatch | Eresim M. Lazatin Jr. | AG-AG00025-C1-2025-11-07 | June 11, 2026 | 8 | 9540 | 7940 | -1600 |
| warning | total_due_formula_mismatch | Eresim M. Lazatin Jr. | AG-AG00025-C1-2025-11-07 | June 18, 2026 | 8 | 9540 | 7940 | -1600 |
| warning | total_due_formula_mismatch | Eresim M. Lazatin Jr. | AG-AG00025-C1-2025-11-07 | April 23, 2026 | 8 | 9540 | 8940 | -600 |
| warning | total_due_formula_mismatch | Eresim M. Lazatin Jr. | AG-AG00025-C1-2025-11-07 | April 30, 2026 | 8 | 9540 | 8440 | -1100 |
| warning | total_due_formula_mismatch | Eresim M. Lazatin Jr. | AG-AG00025-C1-2025-11-07 | May 7, 2026 | 8 | 9540 | 7940 | -1600 |
| warning | total_due_formula_mismatch | Eresim M. Lazatin Jr. | AG-AG00025-C1-2025-11-07 | May 14, 2026 | 8 | 9540 | 7940 | -1600 |
| warning | total_due_formula_mismatch | Jocelyn C. Mondido | AG-AG00026-C1-2026-03-04 | May 21, 2026 | 47 | 2840 | 2260 | -580 |
| warning | total_due_formula_mismatch | Jocelyn C. Mondido | AG-AG00026-C1-2026-03-04 | June 11, 2026 | 47 | 3550 | 3050 | -500 |
| warning | total_due_formula_mismatch | Jocelyn C. Mondido | AG-AG00026-C1-2026-03-04 | June 18, 2026 | 47 | 4260 | 3760 | -500 |
| warning | total_due_formula_mismatch | Jocelyn C. Mondido | AG-AG00026-C1-2026-03-04 | May 7, 2026 | 47 | 2130 | 1840 | -290 |
| warning | total_due_formula_mismatch | Jocelyn C. Mondido | AG-AG00026-C1-2026-03-04 | May 14, 2026 | 47 | 2840 | 2550 | -290 |
| warning | total_due_formula_mismatch | Alma Jane Awayang | AG-AG00035-C2-2026-03-11 | SAN DIONISIOSALAY MAY 22, 2026 | 8 | 13950 | 12950 | -1000 |


## Formula Evidence

- Collection sheets use formulas such as `TOTAL DUE = WEEKLY PAYMENT x NO. OF WEEKS UNPAID` in column N.
- Maturity dates often use release date plus 140 days, matching 20 weeks.
- Weekly payments match GitHub issues #14/#15 for standard loans: for example PHP 30,000 gives 1,500 principal + 300 interest + 300 savings + 10 LPF = PHP 2,110 weekly.
