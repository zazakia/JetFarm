# Loan Payment Reconciliation Dry-Run Report
Generated: 2026-04-20T20:00:37.040Z
Mode: DRY-RUN
Modes: renewals, schedules, schedule-links
Backup/proposal snapshot: docs\reconciliation\loan-payment-repair-backup-2026-04-20T20-00-37-040Z.json
## Summary
| Mode | Proposed | Skipped | Applied |
| --- | ---: | ---: | --- |
| renewals | 2 | 0 |  |
| schedules | 4415 | 0 |  |
| schedule-links | 6668 | 6508 |  |
## renewals proposals
| mode | action | old_loan_id | old_loan_number | old_status | old_collector_id | renewal_loan_id | renewal_loan_number | deducted_amount | borrower_name | schedules_to_mark_paid |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| renewals | close_previous_loan | dee78a62-7146-407b-b378-b3b8fd3d8692 | LN-20260328-1318 | active | 5f0fa53a-f10f-4376-b26a-da9209eee0e8 | b4ebef58-a3e8-4d99-bc4a-d4a61c351d4b | LN-20260328-2182 | 0 | Marilu B. Bande | 32 |
| renewals | close_previous_loan | a77fd915-14d2-4346-923f-af2157db6bcd | LN-20260328-7847 | active | 13b8cb7f-c0b6-46bc-9b71-0a8dbaddbf06 | 9ae93eca-cf6c-489e-bbd5-d0e8c0a10782 | LN-20260328-1495 |  | Teofila V.Tamosa | 2 |

## schedules proposals
| mode | action | schedule_id | loan_id | loan_number | borrower_name | current_status | expected_status | due_date | scheduled_amount | loan_paid |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| schedules | update_schedule_status | 07b76597-88a2-4f74-8c41-276e12a43e44 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | paid | Fri Oct 10 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | 75eb2687-b4fd-498a-8951-17884e7e50f2 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | paid | Sat Oct 11 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | fc5f3e8d-6cf8-41b3-ba76-e36b077e4983 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | paid | Mon Oct 13 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | 14917ba7-070e-47cf-9502-9a9b891ba024 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | paid | Tue Oct 14 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | eb81834c-5002-4a34-a0e3-30fc37cba446 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | paid | Wed Oct 15 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | 5d3b2b44-bf0b-4237-b40e-51a0b547b2c0 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | paid | Thu Oct 16 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | 7194b4c0-e8a9-4e75-b291-03a6956ab821 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | paid | Fri Oct 17 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | c5019a20-f82f-489e-830a-29c0ac24f8b2 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | paid | Sat Oct 18 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | befd19a1-a599-4ebe-9446-2ce0cae0399a | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | partial | Mon Oct 20 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | ccf8f3f2-26a7-4c1a-926f-71e577d387d1 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | late | Tue Oct 21 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | 033c3392-cf34-47b0-afd4-0ce9b05b8d3f | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | late | Wed Oct 22 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | 34d6628d-9bf5-49e0-a91c-a96317f3c01a | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | late | Thu Oct 23 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | ab99bd31-9359-4b8c-bac2-fc9febc3edd5 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | late | Fri Oct 24 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | d9de97ca-0c6a-480a-af41-45ff1e42170d | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | late | Sat Oct 25 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | a2c0e858-7892-4c50-acfa-80f44acffadb | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | late | Mon Oct 27 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | 4f191297-1613-412f-a18f-91ae67f01065 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | late | Tue Oct 28 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | e9830e9e-c6b3-4518-b48b-5714190cc957 | 02797ecc-be04-4c0c-949f-dd6e5c765a65 | LN-20260328-8536 | Myla P. Soria | paid | partial | Wed Oct 29 2025 00:00:00 GMT+0800 (China Standard Time) | 155 | 4630 |
| schedules | update_schedule_status | 33379faf-40bb-4980-bf87-ed079d50fae5 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | late | Wed Oct 29 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | 7a57c10e-9bc7-41c4-ba06-24b209671c4e | 02797ecc-be04-4c0c-949f-dd6e5c765a65 | LN-20260328-8536 | Myla P. Soria | paid | pending | Thu Oct 30 2025 00:00:00 GMT+0800 (China Standard Time) | 155 | 4630 |
| schedules | update_schedule_status | 33c6a733-ca23-48ba-8efd-7865f098a519 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | late | Thu Oct 30 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | 958e83bd-d1d1-40b3-8013-a74a10eced68 | 02797ecc-be04-4c0c-949f-dd6e5c765a65 | LN-20260328-8536 | Myla P. Soria | paid | pending | Fri Oct 31 2025 00:00:00 GMT+0800 (China Standard Time) | 155 | 4630 |
| schedules | update_schedule_status | 00025acd-d743-42c3-ba12-a4749450ef40 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | late | Fri Oct 31 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | 8b8efbdc-ddb3-4a75-a66b-d1a1006c92ea | 02797ecc-be04-4c0c-949f-dd6e5c765a65 | LN-20260328-8536 | Myla P. Soria | paid | pending | Sat Nov 01 2025 00:00:00 GMT+0800 (China Standard Time) | 155 | 4630 |
| schedules | update_schedule_status | 3190fb1a-0287-421c-a617-e15a339496c9 | a13c09a8-da28-4eb5-9fba-26def4a15c23 | LN-20260328-3255 | Glen B. Gadil | pending | late | Sat Nov 01 2025 23:59:17 GMT+0800 (China Standard Time) | 155 | 4200 |
| schedules | update_schedule_status | d1d32186-1354-4695-83d6-bd9e5a174973 | 02797ecc-be04-4c0c-949f-dd6e5c765a65 | LN-20260328-8536 | Myla P. Soria | paid | pending | Mon Nov 03 2025 00:00:00 GMT+0800 (China Standard Time) | 155 | 4630 |

## schedule-links proposals
| mode | action | loan_id | loan_number | borrower_name | payment_id | payment_amount | schedule_id | schedule_remaining_before |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| schedule-links | backfill_payment_schedule_id | 96057e75-fa3b-4c41-8a80-8cf85484cf2c | LN-20260328-0014 | Angelie Andrade | 4ddb8bc8-6235-4bac-8e13-bedddbc03f71 | 222 | ce0f70c8-5a01-441d-bf4b-b89d49030acb | 222 |
| schedule-links | backfill_payment_schedule_id | 96057e75-fa3b-4c41-8a80-8cf85484cf2c | LN-20260328-0014 | Angelie Andrade | 787b8aae-7dab-428d-94c6-3376692ec542 | 222 | d7835af4-9266-4ca7-bb1f-41ba190eeb4d | 222 |
| schedule-links | backfill_payment_schedule_id | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | Jona Pendijito | 1e04fe39-e9d9-4c49-81a5-30fc1af4e60d | 217 | e635b985-5ce6-4b99-a545-4d3a42ba3591 | 217 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 80357f62-f420-4b4f-9ea2-befa6d1820ad | 155 | 967e043f-c99b-4c97-934e-cc216bddc3d6 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 94c0d1b9-87ac-4f02-a312-4575f2068473 | 155 | 4a4791e0-391a-45e6-abe4-5905dd1a29fc | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | c6b8f188-71fa-4a05-92ae-456a4f9367ec | 155 | 8cdec71e-4685-4fba-be4c-a4fef1a9f7dc | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | e21657ad-194d-4dbd-ae5b-08229b937ca8 | 155 | 3cf8858c-58ab-4dcc-93b4-95ff686d1450 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 5a09f2bd-cc71-4165-930d-37e220869982 | 155 | 4b2bd7e0-51ba-451f-8091-c069072dcc97 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 85e3be87-2d62-4e60-92a0-25a847afefbc | 155 | 9d9de720-07cb-480b-85c9-f285121f98ce | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | f036b6db-eb78-4cb4-96bf-3381792d50a8 | 155 | f17e316f-4152-48b3-85c2-81023182d195 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 90294b32-5f14-4147-bfed-adbce688ea01 | 155 | 8e418303-617d-4084-8e54-d1c71e2774f7 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 7ef1125e-1c22-489f-bed0-dd5ee2fa09c2 | 155 | 3505a477-2367-4e0a-ae9a-6eb72e0ca7c4 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 4a0232f4-8618-4562-9cc9-f24de472105e | 155 | 57dd7956-5043-4ad2-ac41-09ad7daaea54 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 316a485f-bead-4da7-96c1-03063905c7d5 | 155 | 39032427-9983-49e3-bfbf-b39d494f2492 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | eefb1ac6-0562-42cf-acf8-d4607dc17714 | 155 | 43e26782-925d-4760-82c4-44ad2ebe717f | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 35ea86b9-77cc-4305-953c-4874563d7f1c | 155 | f356e623-a442-4aee-8320-5dde5ae08362 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 211369a5-4284-4230-8619-530e27bb323d | 155 | f5cbcdbf-e5e1-4a3e-905e-3f7ee784f64c | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 31f558da-03b9-4c80-abe6-e07efccde7f0 | 155 | 77273d4d-2571-4f63-80cc-0f015bc4a2a0 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | c2f67332-05af-4c9a-a585-827fe351b003 | 155 | 8a8e6518-36f5-455f-8ee4-4d586fac129a | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 97e2b633-7f66-440c-93a0-ca5f1986f798 | 155 | ae82d6df-baec-4928-a3b6-f4f098ffb1d9 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | f5960552-8159-4090-8f3d-5c85aa991c8b | 155 | cf00d53a-0c51-4075-b2e4-5a2c9f493e15 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | a3daaf7d-f335-4074-94d2-3060fc0eabe4 | 155 | f5d14171-1811-4a7a-8de8-e18e81f54cc8 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 567f0e61-9160-4aa4-83d4-760eb106c458 | 155 | b317eb01-de5b-4938-b9d5-82c99c65c91f | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 70b30b9b-749e-4c1f-b1b0-1248ed5e6048 | 155 | 5dba6d4f-f181-43cc-90af-c3f857a81278 | 155 |
| schedule-links | backfill_payment_schedule_id | 9fd9c3ae-3cb3-4d4e-8fde-38b613b8fdbe | LN-20260328-0026 | Angielyn Porcadilla | 3696e3f4-f29c-4f0c-9376-e2a656f41e76 | 155 | 3da1f596-cbab-4aed-8a4a-7e0c600d4e7d | 155 |

## schedule-links skipped samples
| mode | action | loan_id | loan_number | payment_id | amount | schedule_id | schedule_remaining_before |
| --- | --- | --- | --- | --- | --- | --- | --- |
| schedule-links | skip_payment_spans_multiple_schedules | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | a5264b1a-b5cc-4696-b914-386b2b9397e3 | 440 | 1521ed2d-3f1f-4308-8ef7-adb10f3f94f6 | 217 |
| schedule-links | skip_payment_spans_multiple_schedules | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | b9f1bbd5-f659-449e-8c3b-1b0ba31ac43d | 430 | dc3a4686-3b1a-4041-915a-582dfc35d9bd | 211 |
| schedule-links | skip_payment_spans_multiple_schedules | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | 4fbcebca-da6c-4a78-8a3e-f0e7ea31e955 | 430 | a7be46f0-6571-451c-a525-2476feaa5b4e | 215 |
| schedule-links | skip_payment_spans_multiple_schedules | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | 6526a7b3-7baa-44b6-a83c-071e7e5987d6 | 434 | fdc1e60e-5519-4bfd-a944-d31fd99208ed | 2 |
| schedule-links | skip_payment_spans_multiple_schedules | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | ebb11c34-e90c-44db-ac6a-1e0326ad7756 | 200 | c3b210ef-3c10-4484-b18e-d87c85cc83f7 | 2 |
| schedule-links | skip_payment_spans_multiple_schedules | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | 3dcf7e1a-2c59-4c9c-8d7b-abf0d2dd67c2 | 500 | 74408ef0-de11-4793-95e2-b100462791af | 19 |
| schedule-links | skip_payment_spans_multiple_schedules | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | 04ca1413-a4f3-4933-b68e-b8f945abd28a | 217 | 59c0c8dc-afd1-4b52-a0c6-be2ecd383aee | 170 |
| schedule-links | skip_payment_spans_multiple_schedules | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | d27dfffe-cdc1-48a4-99ce-3717fa62d591 | 1000 | eca77e19-54d2-49d9-8e25-8fc4fb42d544 | 170 |
| schedule-links | skip_payment_spans_multiple_schedules | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | 59d35277-8149-4516-9c0a-ef401215bddb | 434 | 4163bf21-08db-45b9-b914-937e0885c69a | 38 |
| schedule-links | skip_payment_spans_multiple_schedules | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | 62f647bd-3a5f-4d30-ad42-da1090898b85 | 100 | ebe94c09-e1b1-4abf-87e0-7d2afcf6dd7d | 38 |
| schedule-links | skip_payment_spans_multiple_schedules | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | 445d406f-cd6b-45a3-9a14-7b80b9d94092 | 300 | 6b05fb07-5cdb-4bce-95a1-24f398160dfa | 155 |
| schedule-links | skip_payment_spans_multiple_schedules | 78c02847-b40c-49d1-b397-8c421bea8b75 | LN-20260328-0015 | f02240d9-3ec4-4e89-b855-30fc0ed7bd14 | 316 | e7ff59f3-b980-4894-91df-d54c3b1482a0 | 72 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | 4656de47-9b22-4d51-bb7f-a6b238af9d6f | 620 | 299ff20b-8657-4f92-b914-b17d87928b89 | 310 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | 1bd20d27-6791-43cc-9a1f-1fedf6af602c | 350 | f0b7cc2a-5017-472d-a44b-752e12b0fe3d | 310 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | e194ea01-a566-4551-a5db-5045c7ce77fa | 320 | ccb93dba-5a4c-4576-b2b7-ed38278bfb17 | 270 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | 6619fa37-7fbf-4fc2-a3a2-7195ad82c4a5 | 350 | 021b695b-61fb-4425-8380-7b68c97f6c12 | 260 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | 43e8ac6e-7102-47c6-bc1c-1e14f74260cf | 310 | 82325521-556c-4be7-b170-bb5507ce97a4 | 220 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | ee3367df-6df0-4e78-952a-d3cba9a79f53 | 310 | eb30a22a-0e07-47b5-b7ef-3bc6eb7df377 | 220 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | 6834b7ab-8792-473b-ac65-a9bec0383e33 | 350 | 485e0f51-1bc7-4d28-ae10-bc1623bc9e89 | 220 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | 0c0f6061-d5c7-4bb8-8601-c11e4af8c8b7 | 310 | 59777f1b-cd03-4140-a74b-b12f96cf1c6b | 180 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | f00f8f24-57a6-4120-b804-50425b24533f | 1000 | 5301e8ed-6a3d-4b4e-9602-58a2d7aa0356 | 180 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | 1ba4e150-d3b0-43c3-89be-aa6bff218887 | 600 | dd884151-5564-4c47-b414-39ebecb86669 | 110 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | 6d444e89-5805-46c4-a754-9b9cafffbd58 | 310 | c8687dc4-ef15-44e1-aaa1-aa03af169f42 | 130 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | 17d74215-5506-4823-99a0-83aab548ecd7 | 935 | 39629e34-0e2f-4310-9ba6-5d36875846bb | 130 |
| schedule-links | skip_payment_spans_multiple_schedules | 48cc62c5-accf-4f3c-b1cc-a63d69360af2 | LN-20260328-0052 | eaa1bbe3-906c-4084-ac18-cca634943180 | 350 | 906d2c2b-5636-42c4-97d8-eb54eecda3fe | 125 |

## Safety Notes
- Overpayments, paid loans with balances, and schedule total mismatches are report-only unless explicitly run as report modes.
- Dry-run mode uses a read-only transaction and rolls back.
- Apply mode requires `--confirm-report` and writes only safe mode changes.